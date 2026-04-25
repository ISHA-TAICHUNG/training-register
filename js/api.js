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
    try {
      const res = await fetch(url + "?action=courses", { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (data.ok && data.courses) {
        sessionStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data.courses));
        sessionStorage.setItem(STATUS_CACHE_TIME, String(Date.now()));
        return data.courses;
      }
      return null;
    } catch (e) {
      console.warn("取得課程名額失敗", e);
      return null;
    }
  }

  async function submitRegistration(payload) {
    const url = window.CONFIG.API_URL;
    if (!url || url.includes("PASTE_YOUR_DEPLOYMENT_ID")) {
      throw new Error("尚未設定 API_URL，請聯絡網站管理員");
    }

    // Apps Script 接受 text/plain 避免 CORS preflight
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`伺服器錯誤 (HTTP ${res.status})`);
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
   * - 影像格式（image/*）才壓縮；PDF 不動
   * - 失敗（HEIC 桌機解不出）回原檔，由原 fileSize 驗證接手提示
   * - 壓縮後一律輸出 JPEG（檔案小、相容廣）
   */
  async function compressImage(file) {
    const MIN = 2 * 1024 * 1024;        // < 2MB 不壓
    const MAX_DIM = 2000;               // 長邊
    if (!file.type || !file.type.startsWith("image/")) return file;
    if (file.size < MIN) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      const ratio = Math.min(MAX_DIM / Math.max(width, height), 1);
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, w, h);
      // 第一次嘗試 quality 0.85
      let blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
      // 還是太大 → 降到 0.7
      if (blob && blob.size > 10 * 1024 * 1024) {
        blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.7));
      }
      if (!blob) return file;
      const newName = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg";
      const compressed = new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
      // 若壓出來反而更大（小圖片不該壓），保留原檔
      return compressed.size < file.size ? compressed : file;
    } catch (e) {
      console.warn("壓縮失敗，回原檔", e);
      return file;
    }
  }

  window.API = { submitRegistration, fileToBase64, fetchCoursesStatus, compressImage };
})();
