# 115 高風險職訓報名前台

臺中市政府勞工局勞動檢查處 — 115 年度高風險事業工作者職業安全衛生教育訓練報名網站。

## 資料夾結構

```
/
├── index.html          首頁
├── register.html       4 步驟報名流程
├── done.html           送出成功頁
├── css/main.css        主樣式
├── js/
│   ├── config.js       Apps Script API URL 等設定（部署前必填）
│   ├── state.js        sessionStorage 狀態管理
│   ├── validate.js     欄位驗證
│   ├── api.js          與 Apps Script 通訊
│   └── app.js          多步驟控制器
├── data/
│   ├── courses.json    60 場課程資料（自動從 xlsx 產生）
│   └── qualifications.json  7 項優先錄取資格
└── assets/             logo / favicon
```

## 本地預覽

```bash
cd 網站原始碼
python3 -m http.server 8000
# 瀏覽 http://localhost:8000
```

## 部署

見上層 `../部署指南.md`

## 授權

本 repo 供臺中市政府勞工局勞動檢查處內部使用。
