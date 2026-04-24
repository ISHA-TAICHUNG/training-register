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
      course: null,          // 已選課程物件
      qualifications: [],    // 已勾選資格 id 陣列
      files: {},             // { category_id: [{ name, size, base64 }] }
      form: {},              // 報名資料 59 欄
    };
  }

  function save(s) {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  }

  function clear() {
    sessionStorage.removeItem(KEY);
  }

  window.State = { load, save, clear, defaultState };
})();
