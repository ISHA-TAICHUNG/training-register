/* 報名流程狀態管理（用 sessionStorage，關分頁就清，較安全） */
(function () {
  const KEY = window.CONFIG.STORAGE_KEY;

  function load() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : defaultState();
    } catch (e) {
      return defaultState();
    }
  }

  function defaultState() {
    return {
      step: 0,
      startTime: Date.now(),
      step4StartTime: 0,     // 進 step 4 時記錄；MIN_FILL_TIME 由此起算
      course: null,          // 已選課程物件
      qualifications: [],    // 已勾選資格 id 陣列
      files: {},             // { category_id: [{ name, size, base64 }] }
      form: {},              // 報名資料 59 欄
    };
  }

  /**
   * 安全寫入：捕捉 QuotaExceededError（iOS Safari 私密瀏覽 quota=0 / 多檔上傳累積 > 5MB）
   * 失敗時：先嘗試 fallback（移除 base64 大欄位再存）；都失敗則彈訊息但不中斷流程
   */
  function save(s) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      console.warn("sessionStorage 寫入失敗", e);
      // 第二次嘗試：去掉 files base64（保留 metadata）
      try {
        const lite = JSON.parse(JSON.stringify(s));
        Object.keys(lite.files || {}).forEach(k => {
          (lite.files[k] || []).forEach(f => { delete f.base64; });
        });
        sessionStorage.setItem(KEY, JSON.stringify(lite));
        return false;
      } catch (e2) {
        try { sessionStorage.removeItem(KEY); } catch (e3) {}
        if (!window._quotaWarned) {
          window._quotaWarned = true;
          alert("您的裝置儲存空間不足或處於私密瀏覽模式。\n請保持目前頁面、不要重新整理，直接送出即可。");
        }
        return false;
      }
    }
  }

  function clear() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
  }

  window.State = { load, save, clear, defaultState };
})();
