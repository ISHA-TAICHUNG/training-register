/* 115 高風險職訓報名前台 — 全站設定 */
window.CONFIG = {
  // Apps Script Web App URL（v4 已部署）
  API_URL: "https://script.google.com/macros/s/AKfycbwBpEwX8NmWYap2lNvOWQixSPBoq4ZV1wPpnXdrnGcsnHbTPsFrFpwL4xOAHcp0immr/exec",

  // 網站標題
  AGENCY: "臺中市政府勞工局勞動檢查處",
  YEAR: "115",
  TITLE: "高風險事業職業安全衛生教育訓練",

  // 檔案上傳限制
  FILE_MAX_SIZE: 10 * 1024 * 1024, // 10 MB
  // 支援手機拍照（iOS 預設 HEIC；Android 多為 JPEG）
  FILE_ACCEPT: [
    "image/jpeg", "image/png", "image/webp",
    "image/heic", "image/heif",    // iPhone 相機預設格式
    "application/pdf",
  ],
  FILE_ACCEPT_EXT: ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf",

  // 資料儲存（用 sessionStorage：關頁就清）
  STORAGE_KEY: "isha_register_v1",

  // 欄位預填（測試用，production 應關閉）
  DEBUG_PREFILL: false,

  // 防垃圾投稿：最小填寫時間（毫秒）— 開始填到送出 < N 秒視為機器人
  MIN_FILL_TIME_MS: 5000,
};
