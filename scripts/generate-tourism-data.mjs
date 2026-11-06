import {rename, writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {strFromU8, unzipSync} from 'fflate'

const DATA_URL = 'https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Attraction-json.zip'
const SOURCE_URL = 'https://data.gov.tw/dataset/7777'
const SOURCE_NAME = '交通部觀光署・景點－觀光資訊資料庫'
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
  '吳興街商圈', '北投文物館', 'CITYLINK南港店',
])
const featuredNames = ['台北101', '大稻埕街區_迪化街店屋', '艋舺龍山寺',
  '北投溫泉博物館', '南港山系_象山親山步道', '松山文創園區_松菸風格店家',
  '華山1914文化創意產業園區', '大稻埕碼頭_大稻埕碼頭貨櫃市集',
  '寧夏觀光夜市', '饒河街觀光夜市', '士林觀光夜市', '永康街區']

const fetchWithTimeout = url => fetch(url, {
  signal: AbortSignal.timeout(20000),
  headers: {'user-agent': 'taipei-city-vision-exhibition/1.0'},
})
const response = await fetchWithTimeout(DATA_URL)
if (!response.ok) throw new Error(`官方景點資料下載失敗：HTTP ${response.status}`)
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

const foodAreas = items.filter(item => item.kind === 'food-area' && item.image)
const payload = {
  meta: {
    source: '交通部觀光署・觀光資訊資料庫 V2.1', sourceUrl: SOURCE_URL, dataUrl: DATA_URL,
    imageSource: '官方資料所附影像（個別攝影標示詳見地點介紹）',
    license: '政府資料開放授權條款－第1版', licenseUrl: 'https://data.gov.tw/license',
    fetchedAt: new Date().toISOString(), attractionUpdatedAt: raw.UpdateTime || '',
    foodSource: '觀光景點資料中的夜市、市場、商圈與提供餐飲的景點',
    warnings,
  },
  attractions: items.filter(item => item.kind === 'attraction'),
  foods: foodAreas,
}
// Replace the snapshot only after the official feed has passed validation.
await writeFile(`${outputDirectory}tourism.json.tmp`, JSON.stringify(payload, null, 2))
await rename(`${outputDirectory}tourism.json.tmp`, `${outputDirectory}tourism.json`)
console.log(`已產生 ${payload.attractions.length} 個景點、${foodAreas.length} 個美食地點。`)
