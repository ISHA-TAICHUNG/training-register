/* 與 Apps Script Web App 通訊 */
(function () {
  const STATUS_CACHE_KEY = "courses_status_cache";
  const STATUS_CACHE_TIME = "courses_status_time";
  const CACHE_TTL_MS = 60 * 1000; // 1 分鐘前端快取

  /**
   * 取得所有課程剩餘名額
   * 優先使用 sessionStorage 快取，過期才打 API
   * 失敗時回傳 null（前端顯示「查詢中」，不阻塞流程）
   */
  async function fetchCoursesStatus(force = false) {
    const url = window.CONFIG.API_URL;
    if (!url || url.includes("PASTE_YOUR_DEPLOYMENT_ID")) {
      return null;
    }
    if (!force) {
      try {
        const cached = sessionStorage.getItem(STATUS_CACHE_KEY);
        const cachedAt = parseInt(sessionStorage.getItem(STATUS_CACHE_TIME) || "0");
        if (cached && (Date.now() - cachedAt) < CACHE_TTL_MS) {
          return JSON.parse(cached);
        }
      } catch (e) {}
    }
    // 5 秒 timeout（GET 名額查詢應快速）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url + "?action=courses", {
        mode: "cors",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.ok && data.courses) {
        try {
          sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data.courses));
          sessionStorage.setItem(STATUS_CACHE_TIME, String(Date.now()));
        } catch (storageErr) {
          // sessionStorage 滿時無法快取，但不影響取得資料
          console.warn("名額快取無法寫入", storageErr);
        }
        return data.courses;
      }
      return null;
    } catch (e) {
      console.warn("取得課程名額失敗", e);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function submitRegistration(payload) {
    const url = window.CONFIG.API_URL;
    if (!url || url.includes("PASTE_YOUR_DEPLOYMENT_ID")) {
      throw new Error("尚未設定 API_URL，請聯絡網站管理員");
    }

    // 預檢 body 大小：base64 已膨脹 33%，再加 JSON overhead
    // Apps Script POST body limit 50MB，給安全餘裕設 25MB
    const bodyStr = JSON.stringify(payload);
    const bodySize = new Blob([bodyStr]).size;
    if (bodySize > 25 * 1024 * 1024) {
      throw new Error(`上傳資料過大（${(bodySize/1024/1024).toFixed(1)} MB），請減少檔案數量或畫質`);
    }

    // 加 90s timeout，避免 mobile 4G 大檔上傳 silent drop
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90 * 1000);

    let res;
    try {
      // Apps Script 接受 text/plain 避免 CORS preflight
      res = await fetch(url, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: bodyStr,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        throw new Error("上傳超時（90 秒）— 請確認網路連線並重試。您的資料已保留，可直接再次送出");
      }
      // TypeError = 網路斷線 / DNS 失敗
      throw new Error("網路連線異常 — 請確認 WiFi 或行動網路後重試");
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      // 對學員包裝友善訊息
      if (res.status === 429 || res.status === 503) {
        throw new Error("系統忙線中，請 1–2 分鐘後再送出（您的資料已保留）");
      }
      if (res.status >= 500) {
        throw new Error("伺服器暫時無法處理，請稍後重試或聯絡承辦");
      }
      throw new Error(`送出失敗（HTTP ${res.status}），請稍後再試`);
    }
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || "送出失敗，請稍後再試");
    }
    return data;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        // data:mime;base64,AAAA → 只要後面 base64
        const s = r.result;
        const idx = s.indexOf(",");
        resolve(idx >= 0 ? s.substring(idx + 1) : s);
      };
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /**
   * 自動壓縮圖片：> 2MB 才壓；長邊縮到 2000px、quality 0.85（再次過大 quality 0.7）
   * - 用 <img> + URL.createObjectURL 解碼（iOS Safari 對 HEIC 也支援）
   * - PDF / 非圖片不動
   * - 8 秒 timeout 避免極端情形 hang
   * - 失敗回原檔，由原 fileSize 驗證接手提示
   * - 壓縮後一律輸出 JPEG（檔案小、相容廣）
   */
  async function compressImage(file) {
    const MIN = 2 * 1024 * 1024;        // < 2MB 不壓
    const MAX_DIM = 2000;
    const TIMEOUT_MS = 8000;
    if (!file.type && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "")) return file;
    if (file.type && !file.type.startsWith("image/")) return file;
    if (file.size < MIN) return file;

    // 用 <img> 解碼（iOS Safari 對 HEIC 透過此路徑可正確解碼）
    const url = URL.createObjectURL(file);
    const decode = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    const timer = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("decode timeout")), TIMEOUT_MS)
    );

    try {
      const img = await Promise.race([decode, timer]);
      const { naturalWidth: width, naturalHeight: height } = img;
      const ratio = Math.min(MAX_DIM / Math.max(width, height), 1);
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      let blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
      if (blob && blob.size > 10 * 1024 * 1024) {
        blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.7));
      }
      if (!blob) return file;
      const newName = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg";
      const compressed = new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
      return compressed.size < file.size ? compressed : file;
    } catch (e) {
      console.warn("壓縮失敗，回原檔", e);
      return file;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.API = { submitRegistration, fileToBase64, fetchCoursesStatus, compressImage };
})();
