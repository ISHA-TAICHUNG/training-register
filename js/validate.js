/* 欄位驗證 */
(function () {
  const V = {};

  V.required = (v) => v !== undefined && v !== null && String(v).trim() !== "";

  V.phone = (v) => /^09\d{2}[-\s]?\d{3}[-\s]?\d{3}$/.test(String(v).replace(/\s/g, ""));

  // 中華民國身分證：1 英+1(1 男/2 女)+8 數字 + 檢查碼
  // 字母對應數字（官方表，不規則：I=34, O=35, W=32 等）
  const ID_LETTER_MAP = {
    A:10, B:11, C:12, D:13, E:14, F:15, G:16, H:17, I:34, J:18,
    K:19, L:20, M:21, N:22, O:35, P:23, Q:24, R:25, S:26, T:27,
    U:28, V:29, W:32, X:30, Y:31, Z:33,
  };
  V.idCard = (v) => {
    const s = String(v || "").toUpperCase();
    if (!/^[A-Z][12]\d{8}$/.test(s)) return false;
    const n = ID_LETTER_MAP[s[0]];
    if (n === undefined) return false;
    const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1];
    let sum = Math.floor(n / 10) * weights[0] + (n % 10) * weights[1];
    for (let i = 1; i <= 9; i++) sum += parseInt(s[i], 10) * weights[i];
    sum += parseInt(s[9], 10);
    return sum % 10 === 0;
  };

  // 民國日期 YYYMMDD：除了 1–12 月、1–31 日的格式檢查外，
  // 也驗證實際合法日（拒絕 0810230、0810431、平年 2/29）
  V.rocDate = (v) => {
    if (!/^\d{7}$/.test(v)) return false;
    const roc = parseInt(v.slice(0, 3), 10);
    const m = parseInt(v.slice(3, 5), 10);
    const d = parseInt(v.slice(5, 7), 10);
    if (roc < 1 || roc > 150) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    // 用 Date 反推驗合法日（西元年 = 民國年 + 1911）
    const ad = roc + 1911;
    const dt = new Date(ad, m - 1, d);
    return dt.getFullYear() === ad && dt.getMonth() === m - 1 && dt.getDate() === d;
  };

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
