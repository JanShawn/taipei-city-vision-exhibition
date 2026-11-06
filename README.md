# Taipei City Vision Exhibition

以台北景點、各區美食、主題路線與未來願景為入口的展場觸控網站。沿用新竹版的 Nuxt 4、Vue 3 Composition API、TypeScript、Tailwind CSS 架構及 1080 × 960 畫布等比例縮放方式。[新竹版原始碼](https://github.com/JanShawn/hsinchu-city-vision-exhibition)

## 開發與建置

請使用 Node.js 22.22.3 以上的 22.x、24.15.0 以上的 24.x，或 26 以上版本（符合此次 Nuxt 修正版的需求）。

```bash
npm ci
npm run dev
```

專案已附政府資料快照。照片由瀏覽器透過官方網址載入，建置時只使用既有資料快照。

```bash
npm run typecheck
npm run generate
```

靜態網站產物位於 `.output/public`。此資料夾需透過 HTTP server 提供，不能直接雙擊 `index.html` 使用。

`npm run build` 同樣產生靜態網站；如需包含 Nuxt server route 的部署，使用 `npm run build:server`。

## 與新竹版對應的結構

```text
app/
  app.vue                        # 五個展場畫面、詳情、QR Code、縮放與投票
  assets/css/
    main.css                     # 沿用原展場版型
    hero.css                     # 台北主視覺、來源標示、行政區篩選
public/
  tourism.json                   # 台北政府開放資料快照
scripts/
  generate-tourism-data.mjs      # 更新、篩選、去重並保留官方影像網址
server/api/
  tourism.get.ts                # 供 Nuxt server 使用的相同資料快照
.github/workflows/deploy.yml     # GitHub Pages 靜態部署
nuxt.config.ts
```

保留原專案的單頁展場結構；目前狀態只在此頁面使用，因此沒有額外引入 Pinia。`TourismItem` 描述一個地點，`TourismResponse` 描述資料快照，`TravelRoute` 描述策展路線，皆維持直接易讀的 interface。

## 資料來源與範圍

- 來源：[交通部觀光署「景點－觀光資訊資料庫」](https://data.gov.tw/dataset/7777)，觀光資料標準 V2.1。
- 資料下載：[官方景點 JSON ZIP](https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Attraction-json.zip)。只保留 `PostalAddress.City` 為「臺北市／台北市」且 `ServiceStatus !== 0` 的紀錄，以名稱去重。
- 授權：[政府資料開放授權條款－第1版](https://data.gov.tw/license)。保留來源連結、來源更新時間、原始 ID、原始名稱及影像名稱／攝影標示；個別圖片如另有第三方權利標示，公開或商業使用時仍應確認其適用範圍。
- 本次快照為 350 個景點、95 家美食店家與 24 個美食街區。店家涵蓋台北 12 個行政區。
- 美食店家來自臺北市商業處「臺北市店家改造資料」中分類為美食的紀錄，按地址分類，僅取店家名稱、地址與來源識別。顏加唐的地址在資料集省略行政區，松山區由商業處店家頁核對。[臺北市店家改造資料](https://data.taipei/dataset/detail?id=0d09e03e-bb11-4213-a9c8-6bfd392fbb16) · [商業處松山區店家資料](https://www.tcooc.gov.taipei/cp.aspx?n=A45E901BC1A8C1DD&s=8AAB360BFA842979)
- 美食街區來自交通部觀光署的景點資料，包含夜市、市場與商圈。兩類地點都存放於 `foods`，`kind` 分別是 `restaurant` 和 `food-area`，每筆保留 `sourceName`、`sourceUrl`。
- `tourism.json` 的 `image` 和 `imageSource` 保留官方 HTTPS 圖片網址。缺少網址或瀏覽器載入失敗時，畫面顯示內建的備援圖。
- 若來源沒有完整地址、營業時間或網站，便不顯示該欄位，不自行補寫。QR Code 優先使用來源提供的 HTTPS 網站，缺少時使用原始經緯度組成 Google Maps 查詢連結。

台北101原始紀錄的照片是城市夜景。首頁、景點卡及詳情選用同一開放資料集「幾米月亮公車」紀錄的照片「臺北101與幾米月亮公車」，並在 `imageSourcePlace` 和畫面標示照片來源紀錄。

## 更新資料

```bash
npm run generate:data
```

更新指令讀取交通部觀光署景點 JSON ZIP 與臺北市資料大平臺店家 JSON API。來源下載或驗證失敗時保留既有 `tourism.json`。更新後提交 `tourism.json` 即可。部署流程直接使用已提交的資料快照。

前端讀取 `public/tourism.json`，不依賴 server route，能部署於 GitHub Pages，也能在展場以本機 HTTP server 使用。照片和 QR Code 指向的網頁需連線至外部來源。

## 策展與願景互動

三條路線是本站依政府地點資料編排的「大稻埕散步線、北投溫泉線、信義城市線」，並非政府發布的官方行程。時間為建議估計，開放時間與通行狀態應以各場館公告為準。`app.vue` 的 `routeDefinitions` 可調整路線與站點。

未來願景有步行與交通、文化再生、智慧服務、山河綠地四個方向。投票只存在同一瀏覽器的 `localStorage`，使用獨立的 `taipei-vision-votes` key，每次投票有 2.6 秒確認畫面。不同裝置不會同步，清除瀏覽器資料會重設，不能作為正式民調或跨裝置統計。

## GitHub Pages

推送 `main` 後，GitHub Actions 會執行靜態建置並發布 `.output/public`。網站的 `NUXT_APP_BASE_URL` 由 repository 名稱決定。[台北城市探索指南](https://janshawn.github.io/taipei-city-vision-exhibition/)

## 此次驗證紀錄

- Node.js 24.15.0：`npm run typecheck`、`npm run build`（靜態產生）通過。
- 檢查資料 ID、12 個行政區的店家分布、官方圖片網址及三條路線的 13 個站點。
- 瀏覽器驗證：1080 × 960 版面、720 × 640 等比例縮放、行政區篩選、分頁、詳情、QR Code 顯示、路線站點切換、Escape 關閉詳情。
- 美食頁四個分頁的「看完整介紹」皆位於卡片範圍內；文字區先保留所需高度，照片使用剩餘空間，避免資料說明增加高度後裁切按鈕。
- 願景投票：確認畫面、暫停連點、重新整理後保留票數；測試使用獨立的 localhost 來源。
- QR Code 已驗證畫面產生，未以實體手機掃描。`build:server` 不在本次靜態網站驗證範圍內。

依賴已在原有 semver 範圍內更新，Nuxt 鎖定為 4.6.4。`npm audit fix` 後剩餘 6 個 low、8 個 moderate 提示，沒有 high／critical；尚未強制升級有 breaking change 的工具鏈。靜態建置通過，但 Windows 建置仍會印出 Nitro cache-driver 模組解析 warning；正式交付使用靜態資產，不使用 Nitro server runtime。
