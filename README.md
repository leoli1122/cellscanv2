# 電芯篩選查詢工具 — G450

台塑尖端能源股份有限公司 ∙ 彰濱廠  
品質工程部

---

## 功能

- **掃碼槍輸入**：將輸入框聚焦後，掃碼槍掃描即自動判讀
- **手機相機掃碼**：點擊「📷 開啟相機掃碼」，對準條碼自動辨識（支援 iPhone Safari）
- **即時判讀**：✅ 在名單內 / ❌ 不在名單內
- **每日計數**：今日總掃描、在名單、不在名單即時顯示
- **每日紀錄**：所有掃描記錄存於瀏覽器 localStorage，關閉後仍保留，依日期分組顯示
- **CSV 匯出**：一鍵匯出所有歷史紀錄（含日期、時間、電芯碼、結果、輸入方式）

---

## 檔案結構

```
cellscan/
├── index.html          # 主頁面
├── README.md           # 說明文件
└── assets/
    ├── style.css       # 所有樣式
    ├── app.js          # 掃描邏輯、相機、紀錄、匯出
    └── data.js         # G450 篩選名單（2,198 筆，Set 格式）
```

---

## 使用方式

### 電腦 + 掃碼槍

1. 直接用瀏覽器開啟 `index.html`（不需要任何伺服器）
2. 點擊上方輸入框，掃碼槍掃描後自動判讀

### iPhone / Android 手機

> ⚠️ 手機上用相機掃碼需要透過 **HTTPS** 或 **localhost** 存取，直接開啟本機 HTML 檔案相機功能會被瀏覽器封鎖。
>
> 建議做法：
> - 將資料夾放到 GitHub，用 **GitHub Pages** 部署（見下方）
> - 或在同一 Wi-Fi 的電腦上用 `python3 -m http.server 8080` 啟動簡易伺服器，手機開啟 `http://電腦IP:8080`

### iPhone Safari 相機掃碼步驟

1. 開啟網址 → 點「📷 開啟相機掃碼」
2. 首次使用允許相機權限
3. 將條碼對準畫面中央綠色框線，自動判讀

---

## GitHub Pages 部署（讓手機可直接用相機掃碼）

1. 在 GitHub 建立新 repo，將本資料夾內容推上去
2. 進入 repo → **Settings** → **Pages**
3. Source 選 `main` branch，資料夾選 `/ (root)`
4. 儲存後約 1 分鐘，取得網址如 `https://你的帳號.github.io/repo名稱/`
5. 手機 Safari 開啟該網址即可使用相機掃碼

---

## 更新名單

若需要替換篩選名單，編輯 `assets/data.js`：

```js
const CELL_LIST = [
  "AD1CB0020000AMG450XXXXXX",
  "AD1CB0020000AMG450YYYYYY",
  // ...
];
const CELL_SET = new Set(CELL_LIST);
```

---

## 外部依賴

| 套件 | 版本 | 用途 | CDN |
|------|------|------|-----|
| ZXing Browser | 0.1.5 | 一維條碼相機解碼 | jsDelivr |
| Google Fonts | — | Share Tech Mono / Noto Sans TC | Google |

> 離線環境：可將 ZXing 下載至 `assets/zxing.min.js`，並修改 `index.html` 中的 `<script src>` 路徑。

---

## 技術說明

- **純前端**，無後端、無資料庫，所有資料存於瀏覽器 localStorage
- 名單查詢使用 `Set`，O(1) 查詢速度，2,198 筆資料無延遲
- 相機掃碼使用 [ZXing-js](https://github.com/zxing-js/browser)，支援 Code 128、QR Code 等主流格式
- 相機防重複讀取：同一條碼 2.5 秒內只判讀一次

---

*最後更新：2026-05-26*
