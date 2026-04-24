/* 欄位驗證 */
(function () {
  const V = {};

  V.required = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  V.phone = (v) => /^09\d{2}[-\s]?\d{3}[-\s]?\d{3}$/.test(String(v).replace(/\s/g, ""));

  V.idCard = (v) => {
    // 中華民國身分證：1 英+1(1 男/2 女)+8 數字
    const s = String(v || "").toUpperCase();
    if (!/^[A-Z][12]\d{8}$/.test(s)) return false;
    // 檢查碼驗證
    const map = "ABCDEFGHJKLMNPQRSTUVXYWZIO";
    const letter = s.charCodeAt(0) - 65;
    const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
    const n = 10 + map.indexOf(s[0]);
    let sum = Math.floor(n / 10) * 1 + (n % 10) * 9;
    for (let i = 1; i <= 9; i++) sum += parseInt(s[i]) * weights[i];
    sum += parseInt(s[9]);
    return sum % 10 === 0;
  };

  // 民國日期 YYYMMDD 例 0750101 = 民國 75 年 01 月 01 日
  V.rocDate = (v) => /^\d{7}$/.test(v) && parseInt(v.slice(3, 5)) >= 1 && parseInt(v.slice(3, 5)) <= 12 && parseInt(v.slice(5)) >= 1 && parseInt(v.slice(5)) <= 31;

  V.email = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  V.zip = (v) => /^\d{3,6}$/.test(v);

  V.taxId = (v) => /^\d{8}$/.test(v);  // 公司統編 8 碼

  V.name = (v) => String(v || "").trim().length >= 2;

  V.fileType = (file) => {
    // 先看 MIME
    if (window.CONFIG.FILE_ACCEPT.includes(file.type)) return true;
    // 備援：看副檔名（部分瀏覽器對 HEIC 不給 MIME）
    const name = (file.name || "").toLowerCase();
    const exts = window.CONFIG.FILE_ACCEPT_EXT.split(",").map(e => e.trim());
    return exts.some(ext => name.endsWith(ext));
  };
  V.fileSize = (file) => file.size <= window.CONFIG.FILE_MAX_SIZE;

  window.Validate = V;
})();
