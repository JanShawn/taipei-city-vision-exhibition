import {rename, writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {strFromU8, unzipSync} from 'fflate'

const DATA_URL = 'https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Attraction-json.zip'
const SOURCE_URL = 'https://data.gov.tw/dataset/7777'
const SOURCE_NAME = '交通部觀光署・景點－觀光資訊資料庫'
const FOOD_SHOPS_URL = 'https://data.taipei/api/v1/dataset/af4a3527-e6c6-4c43-a127-6f1f4c893582?scope=resourceAquire&limit=1000'
const FOOD_SHOPS_SOURCE = 'https://data.taipei/dataset/detail?id=0d09e03e-bb11-4213-a9c8-6bfd392fbb16'
const FOOD_SHOPS_NAME = '臺北市商業處・臺北市店家改造資料'
const DISTRICT_PREFIX = /^[臺台]北市(中正|大同|中山|松山|大安|萬華|信義|士林|北投|內湖|南港|文山)/
const outputDirectory = fileURLToPath(new URL('../public/', import.meta.url))

const normalizeText = value => String(value ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim()

// These are official attraction records for food areas, rather than individual restaurants.
const foodAreaNames = new Set([
  '華西街觀光夜市', '士林觀光夜市', '饒河街觀光夜市', '寧夏觀光夜市',
  '景美夜市', '臨江街觀光夜市', '雙城街夜市', '南機場夜市', '廣州街觀光夜市',
  '梧州街觀光夜市', '遼寧街夜市', '大龍街夜市', '西昌街觀光夜市', '延三觀光夜市',
  '永樂布業商場_永樂市場', '永康街區', '濱江果菜市場', '士東市場', '晴光市場',
  '東三水街市場_新富市場', '城中市場', '公館商圈', '內湖737商圈', '師大龍泉商圈',
])
const featuredNames = ['台北101', '大稻埕街區_迪化街店屋', '艋舺龍山寺',
  '北投溫泉博物館', '南港山系_象山親山步道', '松山文創園區_松菸風格店家',
  '華山1914文化創意產業園區', '大稻埕碼頭_大稻埕碼頭貨櫃市集',
  '寧夏觀光夜市', '饒河街觀光夜市', '士林觀光夜市', '永康街區']

const fetchWithTimeout = url => fetch(url, {
  signal: AbortSignal.timeout(20000),
  headers: {'user-agent': 'taipei-city-vision-exhibition/1.0'},
})
const [response, shopsResponse] = await Promise.all([
  fetchWithTimeout(DATA_URL),
  fetchWithTimeout(FOOD_SHOPS_URL),
])
if (!response.ok) throw new Error(`官方景點資料下載失敗：HTTP ${response.status}`)
if (!shopsResponse.ok) throw new Error(`臺北市店家資料下載失敗：HTTP ${shopsResponse.status}`)
const shopRows = (await shopsResponse.json()).result?.results
if (!Array.isArray(shopRows) || !shopRows.length || shopRows.length >= 1000) {
  throw new Error('臺北市店家資料格式或筆數不符，保留既有資料')
}
const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
const entryName = Object.keys(files).find(name => name.endsWith('AttractionList.json'))
if (!entryName) throw new Error('官方壓縮檔缺少 AttractionList.json')
const raw = JSON.parse(strFromU8(files[entryName]).replace(/^\uFEFF/, ''))
if (!Array.isArray(raw.Attractions)) throw new Error('官方資料格式不符，保留既有資料')
const entries = raw.Attractions.filter(item => /^[臺台]北市$/.test(item.PostalAddress?.City)
  && item.ServiceStatus !== 0 && item.AttractionID && item.AttractionName)
if (!entries.length) throw new Error('官方資料沒有臺北市景點，保留既有資料')

const warnings = []
const safeHttpsUrl = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}
const getImage = item => {
  for (const image of item.Images || []) {
    const url = safeHttpsUrl(image.URL)
    if (url) return {image: url, imageCredit: normalizeText(image.Name), imageSource: url}
  }
  warnings.push(`影像暫缺：${item.AttractionName}`)
  return {image: '', imageCredit: '', imageSource: ''}
}
const items = []
const seenNames = new Set()
for (const item of entries) {
  if (seenNames.has(item.AttractionName)) continue
  seenNames.add(item.AttractionName)
  const description = normalizeText(item.Description)
  const address = item.PostalAddress || {}
  const hasCoordinates = typeof item.PositionLat === 'number' && typeof item.PositionLon === 'number'
  items.push({
    id: item.AttractionID,
    kind: foodAreaNames.has(item.AttractionName) ? 'food-area' : 'attraction',
    name: item.AttractionName,
    summary: description.length > 96 ? `${description.slice(0, 96)}…` : description,
    description,
    ...getImage(item),
    imageAlt: item.AttractionName,
    town: normalizeText(address.Town) || '臺北市',
    address: normalizeText(address.StreetAddress),
    phone: normalizeText(item.Telephones?.[0]?.Tel),
    openTime: normalizeText(item.ServiceTimeInfo),
    website: safeHttpsUrl(item.WebsiteURL),
    mapUrl: hasCoordinates ? `https://www.google.com/maps/search/?api=1&query=${item.PositionLat},${item.PositionLon}` : '',
    latitude: item.PositionLat,
    longitude: item.PositionLon,
    updatedAt: item.UpdateTime || '',
    sourceUrl: SOURCE_URL,
    sourceName: SOURCE_NAME,
  })
}
items.sort((a, b) => {
  const rank = name => featuredNames.includes(name) ? featuredNames.indexOf(name) : featuredNames.length
  return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'zh-Hant')
})

const tower = items.find(item => item.id === 'Attraction_379000000A_000217')
const towerExterior = items.find(item => item.id === 'Attraction_379000000A_000396')
if (tower && towerExterior?.image && towerExterior.imageCredit === '臺北101與幾米月亮公車') {
  // Use a photo that shows the tower and identify its record in the same dataset.
  tower.image = towerExterior.image
  tower.imageSource = towerExterior.imageSource
  tower.imageCredit = towerExterior.imageCredit
  tower.imageAlt = towerExterior.imageCredit
  tower.imageSourcePlace = towerExterior.name
}

const foodShops = []
const seenShopIds = new Set()
for (const row of shopRows) {
  if (normalizeText(row.類別) !== '美食') continue
  const id = normalizeText(row.項次)
  const name = normalizeText(row.店家)
  const address = normalizeText(row.地址)
  let district = address.match(DISTRICT_PREFIX)?.[1]
  // The abbreviated address is confirmed by the Commercial Office's Songshan listing.
  if (!district && name === '顏加唐' && address === '臺北市八德路4段803號') district = '松山'
  if (!id || !name || !district || seenShopIds.has(id)) continue
  seenShopIds.add(id)
  foodShops.push({
    id: `TaipeiFoodShop_${id}`,
    kind: 'restaurant',
    name,
    summary: address,
    description: '收錄於臺北市店家改造資料的美食類店家，營業資訊請以店家公告為準。',
    image: '',
    imageSource: '',
    imageCredit: '',
    imageAlt: '',
    town: `${district}區`,
    address,
    phone: '',
    openTime: '',
    website: '',
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`,
    updatedAt: '',
    sourceUrl: FOOD_SHOPS_SOURCE,
    sourceName: FOOD_SHOPS_NAME,
  })
}
if (!foodShops.length) throw new Error('臺北市店家資料沒有可分類的美食店家，保留既有資料')
const foodAreas = items.filter(item => item.kind === 'food-area')
const payload = {
  meta: {
    source: '交通部觀光署・觀光資訊資料庫 V2.1', sourceUrl: SOURCE_URL, dataUrl: DATA_URL,
    imageSource: '官方資料所附影像（個別攝影標示詳見地點介紹）',
    license: '政府資料開放授權條款－第1版', licenseUrl: 'https://data.gov.tw/license',
    fetchedAt: new Date().toISOString(), attractionUpdatedAt: raw.UpdateTime || '',
    foodSource: '臺北市店家改造資料的美食類店家，以及觀光景點資料的夜市、市場與美食街區',
    foodShopsSourceUrl: FOOD_SHOPS_SOURCE,
    foodShopsSourceName: FOOD_SHOPS_NAME,
    warnings,
  },
  attractions: items.filter(item => item.kind === 'attraction'),
  foods: [...foodShops, ...foodAreas],
}
// Replace the snapshot only after the official feed has passed validation.
await writeFile(`${outputDirectory}tourism.json.tmp`, JSON.stringify(payload, null, 2))
await rename(`${outputDirectory}tourism.json.tmp`, `${outputDirectory}tourism.json`)
console.log(`已產生 ${payload.attractions.length} 個景點、${foodShops.length} 家美食店家、${foodAreas.length} 個美食街區。`)
