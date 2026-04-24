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

  window.API = { submitRegistration, fileToBase64, fetchCoursesStatus };
})();
