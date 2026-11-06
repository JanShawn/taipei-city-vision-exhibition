<script setup lang="ts">
import QrcodeVue from 'qrcode.vue'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock3,
  Home,
  Landmark,
  Leaf,
  LoaderCircle,
  MapPin,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Route,
  Sparkles,
  UtensilsCrossed,
  X,
} from '@lucide/vue'

type Screen = 'home' | 'attractions' | 'food' | 'routes' | 'vision'
type TourismKind = 'attraction' | 'food-area'

interface TourismItem {
  id: string
  kind: TourismKind
  name: string
  summary: string
  description: string
  image: string
  imageSource?: string
  imageSourcePlace?: string
  imageAlt: string
  imageCredit: string
  sourceUrl: string
  sourceName?: string
  mapUrl: string
  town: string
  address: string
  phone: string
  openTime: string
  website: string
  latitude?: number
  longitude?: number
  updatedAt: string
}

interface TourismResponse {
  meta: {
    source: string
    sourceUrl: string
    fetchedAt: string
    attractionUpdatedAt: string
    warnings: string[]
  }
  attractions: TourismItem[]
  foods: TourismItem[]
}

interface TravelRoute {
  id: string
  title: string
  kicker: string
  duration: string
  description: string
  accent: string
  stops: TourismItem[]
}

const DESIGN_WIDTH = 1080
const DESIGN_HEIGHT = 960

const currentScreen = ref<Screen>('home')
const viewportScale = ref(1)
const selectedItem = ref<TourismItem | null>(null)
const selectedRoute = ref<TravelRoute | null>(null)
const activeTown = ref('全部')
const attractionPage = ref(0)
const foodPage = ref(0)

const placeTypeLabels: Record<TourismKind, string> = {
  attraction: '城市景點',
  'food-area': '美食地點',
}

const tourismBaseUrl = (useRuntimeConfig().app.baseURL || '/').replace(
  /\/$/,
  '',
)
const tourismDataUrl = `${tourismBaseUrl}/tourism.json`
const fallbackImageUrl = 'data:image/svg+xml,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640">
    <rect width="960" height="640" fill="#102833"/>
    <text x="480" y="320" fill="#e9f3f4" font-family="sans-serif" font-size="32" text-anchor="middle">
      官方影像暫時無法載入
    </text>
  </svg>
`)
const withImageUrl = (item: TourismItem): TourismItem => {
  const image = [item.image, item.imageSource].find(url => url?.startsWith('https://'))
  return {...item, image: image || fallbackImageUrl}
}
const heroItem = computed(() => data.value?.attractions.find(item => item.name === '台北101'))

const {data, status, error, refresh} = useFetch<TourismResponse>(
  tourismDataUrl,
  {
    key: 'taipei-tourism-feed-v1',
    transform: (payload) => ({
      ...payload,
      attractions: payload.attractions.map(withImageUrl),
      foods: payload.foods.map(withImageUrl),
    }),
    server: false,
    lazy: true,
  },
)

const dedupeTourismItems = (items: TourismItem[]) => {
  const uniqueItems = new Map<string, TourismItem>()

  for (const item of items) {
    const normalizedName = item.name.trim()
    if (!uniqueItems.has(normalizedName)) {
      uniqueItems.set(normalizedName, item)
    }
  }

  return [...uniqueItems.values()]
}

const attractions = computed(() =>
  dedupeTourismItems(data.value?.attractions || []),
)
const foods = computed(() =>
  dedupeTourismItems((data.value?.foods || []).filter(item => item.kind === 'food-area' && item.image.startsWith('https://'))),
)
const isLoading = computed(
  () => status.value === 'idle' || status.value === 'pending',
)

const navItems = [
  {id: 'home' as Screen, label: '首頁', sub: '今天怎麼玩', icon: Home},
  {
    id: 'attractions' as Screen,
    label: '精選景點',
    sub: '城市故事現場',
    icon: Landmark,
  },
  {
    id: 'food' as Screen,
    label: '商圈資訊',
    sub: '按行政區探索',
    icon: UtensilsCrossed,
  },
  {id: 'routes' as Screen, label: '旅遊推薦', sub: '三條主題路線', icon: Route},
  {
    id: 'vision' as Screen,
    label: '未來藍圖',
    sub: '一起累積想法',
    icon: Sparkles,
  },
]

const towns = computed(() => {
  const source =
    currentScreen.value === 'food' ? foods.value : attractions.value
  return ['全部', ...new Set(source.map((item) => item.town).filter(Boolean))]
})

const filteredAttractions = computed(() =>
  activeTown.value === '全部'
    ? attractions.value
    : attractions.value.filter((item) => item.town === activeTown.value),
)

const filteredFoods = computed(() => foods.value.filter(item =>
  activeTown.value === '全部' || item.town === activeTown.value,
))

const attractionPages = computed(() =>
  Math.max(1, Math.ceil(filteredAttractions.value.length / 6)),
)
const foodPages = computed(() =>
  Math.max(1, Math.ceil(filteredFoods.value.length / 6)),
)
const visibleAttractions = computed(() =>
  filteredAttractions.value.slice(
    attractionPage.value * 6,
    attractionPage.value * 6 + 6,
  ),
)
const visibleFoods = computed(() =>
  filteredFoods.value.slice(foodPage.value * 6, foodPage.value * 6 + 6),
)

const featuredStories = ref<TourismItem[]>([])

const refreshFeaturedStories = () => {
  const government =
    attractions.value.find((item) => item.name === '台北101') ||
    attractions.value[0]
  const otherAttractions = attractions.value.filter(
    (item) => item.id !== government?.id,
  )
  const randomAttraction =
    otherAttractions[Math.floor(Math.random() * otherAttractions.length)]
  const randomFood =
    foods.value[Math.floor(Math.random() * foods.value.length)]

  featuredStories.value = [
    government,
    randomFood,
    randomAttraction,
  ].filter((item): item is TourismItem => Boolean(item))
}

watch([attractions, foods], refreshFeaturedStories, {immediate: true})

const routeDefinitions = [
  {
    id: 'dadaocheng', title: '大稻埕散步線', kicker: '街屋、信仰與河岸',
    duration: '建議半日・步行', accent: '#67e8d5',
    description: '走進迪化街的老店與街屋，沿著霞海城隍廟、永樂市場，慢慢走向大稻埕碼頭。停留時間可依體力調整。',
    names: ['大稻埕街區_迪化街店屋', '台北霞海城隍廟', '永樂布業商場_永樂市場', '大稻埕碼頭_大稻埕碼頭貨櫃市集'],
  },
  {
    id: 'beitou', title: '北投溫泉線', kicker: '綠建築與溫泉文化',
    duration: '建議半日・步行', accent: '#f5c96a',
    description: '從新北投車站出發，串起公園、圖書館與溫泉博物館，再沿山坡走向地熱谷。開放時間以各場館公告為準。',
    names: ['新北投車站', '北投公園', '臺北市立圖書館北投分館', '北投溫泉博物館', '地熱谷_地獄谷_鬼湖'],
  },
  {
    id: 'xinyi', title: '信義城市線', kicker: '文創、街景與山稜',
    duration: '建議一日・步行與轉乘', accent: '#9eb8ff',
    description: '從松山文創園區走向台北101，最後以象山步道收進城市天際線。步道有階梯，請依天候與體力決定是否前往。',
    names: ['松山文創園區_松菸風格店家', '台北101', '象山公園', '南港山系_象山親山步道'],
  },
]

const travelRoutes = computed<TravelRoute[]>(() =>
  routeDefinitions.map((route) => ({
    ...route,
    stops: route.names
      .map((name) => [...attractions.value, ...foods.value].find((item) => item.name === name))
      .filter((item): item is TourismItem => Boolean(item)),
  })),
)

const VOTE_CONFIRMATION_DURATION = 2600
const voteConfirmation = ref<{
  title: string
  accent: string
  count: number
} | null>(null)
let voteConfirmationTimer: ReturnType<typeof setTimeout> | null = null

const VISION_STORAGE_KEY = 'taipei-vision-votes'
const visionOptions = [
  {
    id: 'walkable',
    title: '步行與交通',
    description: '讓日常移動更安全、好走，也更容易轉乘。',
    icon: Route,
    accent: '#67e8d5',
  },
  {
    id: 'culture',
    title: '文化再生',
    description: '支持老建築、地方故事與創作者持續被看見。',
    icon: Landmark,
    accent: '#f5c96a',
  },
  {
    id: 'smart',
    title: '智慧服務',
    description: '用即時資訊改善交通、旅遊與公共服務體驗。',
    icon: Sparkles,
    accent: '#aeb8ff',
  },
  {
    id: 'green',
    title: '山河綠地',
    description: '串連山林、河岸與公園，增加城市韌性。',
    icon: Leaf,
    accent: '#89e6a8',
  },
]

const visionAllocation = reactive<Record<string, number>>({
  walkable: 0,
  culture: 0,
  smart: 0,
  green: 0,
})

const getVisionPoints = (id: string) => visionAllocation[id] ?? 0
const totalVisionVotes = computed(() =>
  Object.values(visionAllocation).reduce((total, value) => total + value, 0),
)
const rankedVision = computed(() =>
  [...visionOptions].sort(
    (first, second) => getVisionPoints(second.id) - getVisionPoints(first.id),
  ),
)
const getVisionShare = (id: string) =>
  totalVisionVotes.value === 0
    ? 0
    : (getVisionPoints(id) / totalVisionVotes.value) * 100
const getVisionStrength = (id: string) => {
  const highest = Math.max(
    ...visionOptions.map((option) => getVisionPoints(option.id)),
    1,
  )
  const points = getVisionPoints(id)
  return points === 0 ? 5 : 18 + (points / highest) * 82
}
const visionSummary = computed(() => {
  if (totalVisionVotes.value === 0) return '等待第一個城市想法'

  const primary = rankedVision.value[0]
  const secondary = rankedVision.value.find(
    (option) => option.id !== primary?.id && getVisionPoints(option.id) > 0,
  )
  if (!primary) return '等待第一個城市想法'
  return secondary ? `${primary.title} × ${secondary.title}` : primary.title
})
const visionMomentum = computed(() => {
  if (totalVisionVotes.value === 0) return '願景從你的第一次選擇開始'
  if (totalVisionVotes.value < 10) return '新的城市想法正在聚集'
  if (totalVisionVotes.value < 25) return '共同方向逐漸清晰'
  if (totalVisionVotes.value < 50) return '城市想像持續生長'
  return '大家正在一起推動未來台北'
})
const visionNarrative = computed(() => {
  if (totalVisionVotes.value === 0)
    return '點選你重視的方向，每一次投入都會留在這座城市的共同願景裡。'

  const primaryId = rankedVision.value[0]?.id
  const narratives: Record<string, string> = {
    walkable: '目前最受重視的是人的移動，讓舊城、社區與公共運輸重新連在一起。',
    culture: '目前最受重視的是文化共生，讓歷史空間與新世代創作成為城市日常。',
    smart: '目前最受重視的是有感科技，讓資訊協助每一次移動與生活選擇。',
    green: '目前最受重視的是自然韌性，讓山林、河岸與城市共同呼吸。',
  }
  return narratives[primaryId || 'walkable'] || narratives.walkable
})

const addVisionVote = (id: string) => {
  if (voteConfirmation.value) return

  const option = visionOptions.find((item) => item.id === id)
  if (!option) return

  const nextCount = Math.min(getVisionPoints(id) + 1, Number.MAX_SAFE_INTEGER)
  visionAllocation[id] = nextCount
  voteConfirmation.value = {
    title: option.title,
    accent: option.accent,
    count: nextCount,
  }

  if (voteConfirmationTimer) clearTimeout(voteConfirmationTimer)
  voteConfirmationTimer = setTimeout(() => {
    voteConfirmation.value = null
    voteConfirmationTimer = null
  }, VOTE_CONFIRMATION_DURATION)
}

const restoreVisionVotes = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(VISION_STORAGE_KEY) || '{}',
    ) as Record<string, unknown>
    for (const option of visionOptions) {
      const value = saved[option.id]
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) {
        visionAllocation[option.id] = Math.floor(value)
      }
    }
  } catch {
    // Invalid local data should not interrupt the exhibition experience.
  }
}

watch(
  visionAllocation,
  (value) => {
    if (import.meta.client) {
      try { localStorage.setItem(VISION_STORAGE_KEY, JSON.stringify(value)) }
      catch { /* Storage may be disabled on the exhibition device. */ }
    }
  },
  {deep: true},
)
const canvasStyle = computed(() => ({
  transform: `scale(${viewportScale.value})`,
}))
const shellStyle = computed(() => ({
  width: `${DESIGN_WIDTH * viewportScale.value}px`,
  height: `${DESIGN_HEIGHT * viewportScale.value}px`,
}))

const closeDetails = (event: KeyboardEvent) => {
  if (event.key === 'Escape') { selectedItem.value = null; selectedRoute.value = null }
}

const updateScale = () => {
  viewportScale.value = Math.min(
    window.innerWidth / DESIGN_WIDTH,
    window.innerHeight / DESIGN_HEIGHT,
  )
}

const setScreen = (screen: Screen) => {
  currentScreen.value = screen
  if (screen === 'home') refreshFeaturedStories()
  activeTown.value = '全部'
  attractionPage.value = 0
  foodPage.value = 0
  selectedItem.value = null
  selectedRoute.value = null
}

const openStopDetail = (stop: TourismItem) => {
  selectedRoute.value = null
  selectedItem.value = stop
}

const selectTown = (town: string) => {
  activeTown.value = town
  attractionPage.value = 0
  foodPage.value = 0
}

const changePage = (kind: TourismKind, direction: number) => {
  if (kind === 'attraction') {
    attractionPage.value =
      (attractionPage.value + direction + attractionPages.value) %
      attractionPages.value
  } else {
    foodPage.value =
      (foodPage.value + direction + foodPages.value) % foodPages.value
  }
}

const handleImageError = (event: Event) => {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') === fallbackImageUrl) return

  image.src = fallbackImageUrl
}

onMounted(() => {
  restoreVisionVotes()
  refreshFeaturedStories()
  updateScale()
  window.addEventListener('resize', updateScale)
  window.addEventListener('keydown', closeDetails)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale)
  window.removeEventListener('keydown', closeDetails)
  if (voteConfirmationTimer) clearTimeout(voteConfirmationTimer)
})
</script>

<template>
  <div class="stage">
    <div class="stage-shell" :style="shellStyle">
      <main class="exhibit-canvas" :style="canvasStyle">
        <section
          v-if="currentScreen === 'home'"
          class="screen home-screen hero-artwork"
        >
          <img
            class="hero-background"
            :src="heroItem?.image || fallbackImageUrl"
            alt=""
            referrerpolicy="no-referrer"
            @error="handleImageError"
          />
          <div class="home-content">
            <div class="home-intro">
              <p class="eyebrow">TAIPEI CITY GUIDE · LOCAL STORIES</p>
              <h1>城市很好逛<br /><span>美食很好吃</span></h1>
              <p class="home-lead">
                從百年街屋、夜市日常到山城河岸，帶你重新認識今天的台北。
              </p>

              <button
                class="primary-action"
                type="button"
                @click="setScreen('attractions')"
              >
                開始探索台北
                <ArrowRight :size="21" />
              </button>

              <div class="live-stats" aria-label="目前資料筆數">
                <div>
                  <strong>{{ attractions.length || '—' }}</strong
                  ><span>精選景點</span>
                </div>
                <div>
                  <strong>{{ foods.length || '—' }}</strong
                  ><span>商圈資訊</span>
                </div>
                <div><strong>03</strong><span>主題路線</span></div>
              </div>
            </div>

            <div class="story-board">
              <div class="section-label">
                <span>TODAY IN TAIPEI</span>
              </div>

              <div v-if="isLoading" class="story-loading">
                <LoaderCircle :size="32" class="spin" />
                <strong>正在載入台北旅遊資料</strong>
                <span>讀取政府開放資料快照</span>
              </div>

              <div v-else-if="error" class="story-loading error-state">
                <RefreshCw :size="30" />
                <strong>官方資料暫時無法載入</strong>
                <span>請確認網路後重新嘗試</span>
                <button type="button" @click="refresh()">重新載入</button>
              </div>

              <div v-else-if="!featuredStories.length" class="story-loading">
                <MapPin :size="30" /><strong>目前沒有可顯示的地點</strong>
              </div>
              <div v-else class="story-grid">
                <button
                  v-for="(item, index) in featuredStories"
                  :key="item.id"
                  class="story-card"
                  :class="{featured: index === 0}"
                  type="button"
                  @click="selectedItem = item"
                >
                  <img
                    :src="item.image"
                    :alt="item.imageAlt"
                    :class="{'tower-photo': item.imageSourcePlace}"
                    referrerpolicy="no-referrer"
                    @error="handleImageError"
                  />
                  <span class="story-shade" />
                  <span class="story-copy">
                    <small>{{
                      item.kind === 'food-area'
                        ? placeTypeLabels[item.kind]
                        : item.town + '景點'
                    }}</small>
                    <strong>{{ item.name }}</strong>
                    <span>{{ item.summary }}</span>
                    <b>閱讀介紹 <ArrowRight :size="15" /></b>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div v-if="data" class="dataset-note">
            <a :href="data.meta.sourceUrl" class="source-link" target="_blank" rel="noopener noreferrer">
              資料來源：交通部觀光署・景點－觀光資訊資料庫（V2.1）
            </a>
            <span>｜{{ data.meta.attractionUpdatedAt.slice(0, 10) }}</span>
            <br />
            <span>本資料依 </span>
            <a href="https://data.gov.tw/license" class="source-link" target="_blank" rel="noopener noreferrer">
              政府資料開放授權條款－第1版
            </a>
            <span> 釋出</span>
          </div>
          <small class="hero-credit">
            影像：{{ heroItem?.imageCredit || '政府開放資料' }}
            <template v-if="heroItem?.imageSourcePlace">｜來源紀錄：{{ heroItem.imageSourcePlace }}</template>
          </small>
        </section>

        <section
          v-else-if="currentScreen === 'attractions'"
          class="screen content-screen"
        >
          <div class="screen-heading">
            <div>
              <p class="eyebrow">SEE · WALK · DISCOVER</p>
              <h2>精選景點 <span>把城市故事走一遍</span></h2>
            </div>
          </div>

          <div class="filter-row">
            <button
              v-for="town in towns"
              :key="town"
              type="button"
              :class="{active: activeTown === town}"
              @click="selectTown(town)"
            >
              {{ town }}
            </button>
          </div>

          <div v-if="isLoading" class="card-grid skeleton-grid">
            <div v-for="index in 6" :key="index" class="skeleton-card" />
          </div>
          <div v-else-if="error" class="story-loading error-state">
            <RefreshCw :size="30" /><strong>資料暫時無法載入</strong>
            <button type="button" @click="refresh()">重新載入</button>
          </div>
          <div v-else-if="!filteredAttractions.length" class="story-loading">
            <MapPin :size="30" /><strong>這個區域目前沒有資料</strong>
            <button type="button" @click="selectTown('全部')">查看全部</button>
          </div>
          <div v-else class="card-grid">
            <button
              v-for="item in visibleAttractions"
              :key="item.id"
              class="place-card"
              type="button"
              @click="selectedItem = item"
            >
              <span class="place-image">
                <img
                  :src="item.image"
                  :alt="item.imageAlt"
                  :class="{'tower-photo': item.imageSourcePlace}"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <small><MapPin :size="13" /> {{ item.town }}</small>
              </span>
              <span class="place-body">
                <strong>{{ item.name }}</strong>
                <span>{{ item.summary }}</span>
                <b>看完整介紹 <ChevronRight :size="16" /></b>
              </span>
            </button>
          </div>

          <div class="page-controls">
            <button
              type="button"
              aria-label="上一頁"
              @click="changePage('attraction', -1)"
            >
              <ChevronLeft :size="20" />
            </button>
            <span>{{ attractionPage + 1 }} / {{ attractionPages }}</span>
            <button
              type="button"
              aria-label="下一頁"
              @click="changePage('attraction', 1)"
            >
              <ChevronRight :size="20" />
            </button>
          </div>
        </section>

        <section
          v-else-if="currentScreen === 'food'"
          class="screen content-screen food-screen"
        >
          <div class="screen-heading">
            <div>
              <p class="eyebrow">TASTE · MARKET · LOCAL</p>
              <h2>商圈資訊</h2>
            </div>
          </div>

          <div class="filter-row food-filter">
            <button
              v-for="town in towns"
              :key="town"
              type="button"
              :class="{active: activeTown === town}"
              @click="selectTown(town)"
            >
              {{ town }}
            </button>
          </div>

          <div v-if="isLoading" class="card-grid skeleton-grid">
            <div v-for="index in 6" :key="index" class="skeleton-card" />
          </div>
          <div v-else-if="error" class="story-loading error-state">
            <RefreshCw :size="30" /><strong>資料暫時無法載入</strong>
            <button type="button" @click="refresh()">重新載入</button>
          </div>
          <div v-else-if="!filteredFoods.length" class="story-loading">
            <MapPin :size="30" /><strong>這個區域目前沒有資料</strong>
            <button type="button" @click="selectTown('全部')">查看全部</button>
          </div>
          <div v-else class="card-grid">
            <button
              v-for="item in visibleFoods"
              :key="item.id"
              class="place-card food-card"
              type="button"
              @click="selectedItem = item"
            >
              <span class="place-image">
                <img
                  :src="item.image"
                  :alt="item.imageAlt"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <small><UtensilsCrossed :size="13" /> {{ item.town }}</small>
              </span>
              <span class="place-body">
                <strong>{{ item.name }}</strong>
                <span>{{ item.summary }}</span>
                <b>看完整介紹 <ChevronRight :size="16" /></b>
              </span>
            </button>
          </div>

          <div class="page-controls food-controls">
            <button
              type="button"
              aria-label="上一頁"
              @click="changePage('food-area', -1)"
            >
              <ChevronLeft :size="20" />
            </button>
            <span>{{ foodPage + 1 }} / {{ foodPages }}</span>
            <button
              type="button"
              aria-label="下一頁"
              @click="changePage('food-area', 1)"
            >
              <ChevronRight :size="20" />
            </button>
          </div>
        </section>

        <section
          v-else-if="currentScreen === 'routes'"
          class="screen content-screen routes-screen"
        >
          <div class="screen-heading">
            <div>
              <p class="eyebrow">THREE WAYS TO MEET THE CITY</p>
              <h2>旅遊推薦 <span>本站策展路線・時間為建議估計</span></h2>
            </div>
          </div>

          <div class="route-grid">
            <button
              v-for="routeItem in travelRoutes"
              :key="routeItem.id"
              class="route-card"
              type="button"
              :style="{'--route-accent': routeItem.accent}"
              @click="selectedRoute = routeItem"
            >
              <span class="route-image">
                <img
                  v-if="routeItem.stops[0]"
                  :src="routeItem.stops[0].image"
                  :alt="routeItem.title"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <span class="route-number">{{
                  String(travelRoutes.indexOf(routeItem) + 1).padStart(2, '0')
                }}</span>
                <span class="route-time"
                  ><Clock3 :size="14" /> {{ routeItem.duration }}</span
                >
              </span>
              <span class="route-body">
                <small>{{ routeItem.kicker }}</small>
                <strong>{{ routeItem.title }}</strong>
                <span>{{ routeItem.description }}</span>
                <span class="stop-preview">
                  <b
                    v-for="stop in routeItem.stops.slice(0, 3)"
                    :key="stop.id"
                    >{{ stop.name }}</b
                  >
                  <em>共 {{ routeItem.stops.length }} 站</em>
                </span>
                <span class="route-link"
                  >查看完整路線 <ArrowRight :size="17"
                /></span>
              </span>
            </button>
          </div>
        </section>

        <section v-else class="screen content-screen vision-screen">
          <div class="vision-intro">
            <div>
              <p class="eyebrow">BUILD YOUR TAIPEI 2035</p>
              <h2>調配你的未來台北</h2>
              <p>選擇你重視的方向，每一次投入都會持續累積成共同願景。</p>
            </div>
          </div>

          <div class="vision-layout">
            <div class="vision-options">
              <article
                v-for="option in visionOptions"
                :key="option.id"
                class="vision-allocation"
                :style="{'--vision-accent': option.accent}"
              >
                <div class="vision-option-heading">
                  <span class="vision-icon"
                    ><component :is="option.icon" :size="26"
                  /></span>
                  <span
                    ><strong>{{ option.title }}</strong
                    ><small>{{ option.description }}</small></span
                  >
                </div>
                <div class="vision-vote-stats">
                  <span
                    ><strong>{{ getVisionPoints(option.id) }}</strong
                    ><small>次選擇</small></span
                  >
                  <em>{{ Math.round(getVisionShare(option.id)) }}%</em>
                </div>
                <div
                  class="allocation-meter"
                  :aria-label="
                    option.title +
                    ' 已累積 ' +
                    getVisionPoints(option.id) +
                    ' 次選擇'
                  "
                >
                  <span :style="{width: getVisionShare(option.id) + '%'}" />
                </div>
                <button
                  class="vision-vote-button"
                  type="button"
                  :disabled="Boolean(voteConfirmation)"
                  :aria-label="'投入' + option.title"
                  @click="addVisionVote(option.id)"
                >
                  <Plus :size="21" /> 投入這個方向
                </button>
              </article>
            </div>

            <div class="vision-result">
              <span class="vision-orbit orbit-one" />
              <span class="vision-orbit orbit-two" />
              <div class="collective-score">
                <span>城市共同累積</span>
                <strong>{{ totalVisionVotes }}</strong>
                <small>次選擇</small>
              </div>
              <div class="vision-result-copy">
                <small>CITY MOMENTUM</small>
                <h3>{{ visionMomentum }}</h3>
                <b>{{ visionSummary }}</b>
                <p>{{ visionNarrative }}</p>
              </div>
              <div class="momentum-field" aria-label="各方向累積成長">
                <div
                  v-for="option in visionOptions"
                  :key="option.id"
                  class="momentum-column"
                  :style="{'--vision-accent': option.accent}"
                >
                  <span class="momentum-track"
                    ><i :style="{height: getVisionStrength(option.id) + '%'}"
                  /></span>
                  <strong>{{ getVisionPoints(option.id) }}</strong>
                  <small>{{ option.title }}</small>
                </div>
              </div>
              <div class="recipe-chart" aria-label="共同願景比例">
                <span
                  v-for="option in visionOptions"
                  :key="option.id"
                  :style="{
                    width: getVisionShare(option.id) + '%',
                    background: option.accent,
                  }"
                />
              </div>
              <div class="recipe-legend">
                <span v-for="option in visionOptions" :key="option.id"
                  ><i :style="{background: option.accent}" />{{ option.title }}
                  {{ Math.round(getVisionShare(option.id)) }}%</span
                >
              </div>
            </div>
          </div>

          <div class="vision-note">
            累積結果保存在這台展場裝置；此互動不代表政府政策統計或民調結果。
          </div>
        </section>

        <nav class="bottom-nav" aria-label="主要導覽">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            :class="{active: currentScreen === item.id}"
            @click="setScreen(item.id)"
          >
            <component :is="item.icon" :size="24" />
            <span
              ><strong>{{ item.label }}</strong></span
            >
          </button>
        </nav>

        <Transition name="vote-confirmation">
          <div
            v-if="voteConfirmation"
            class="vote-confirmation-overlay"
            role="status"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div
              class="vote-confirmation-card"
              :style="{'--confirmation-accent': voteConfirmation.accent}"
            >
              <span class="vote-confirmation-icon"
                ><Check :size="42" stroke-width="2.5"
              /></span>
              <p class="eyebrow">VOTE RECORDED</p>
              <h2>感謝您的投票</h2>
              <p>你為「{{ voteConfirmation.title }}」加入了一次城市選擇。</p>
              <div class="vote-confirmation-total">
                <span>這個方向目前累積</span>
                <strong>{{ voteConfirmation.count }}</strong>
                <small>次選擇</small>
              </div>
              <div class="vote-confirmation-progress" aria-hidden="true">
                <span />
              </div>
              <small>稍後即可繼續選擇</small>
            </div>
          </div>
        </Transition>

        <div
          v-if="selectedItem"
          class="detail-overlay"
          @click.self="selectedItem = null"
        >
          <article class="detail-panel">
            <button
              class="close-button"
              type="button"
              aria-label="關閉介紹"
              @click="selectedItem = null"
            >
              <X :size="24" />
            </button>
            <div class="detail-image">
              <img
                :src="selectedItem.image"
                :alt="selectedItem.imageAlt"
                :class="{'tower-photo': selectedItem.imageSourcePlace}"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <span>{{ placeTypeLabels[selectedItem.kind] }}</span>
            </div>
            <div class="detail-copy">
              <p class="eyebrow">DISCOVER TAIPEI</p>
              <h2>{{ selectedItem.name }}</h2>
              <p class="detail-description">{{ selectedItem.description }}</p>
              <dl>
                <div v-if="selectedItem.address">
                  <dt><MapPin :size="17" /> 地址</dt>
                  <dd>{{ selectedItem.address }}</dd>
                </div>
                <div v-if="selectedItem.openTime">
                  <dt><Clock3 :size="17" /> 時間</dt>
                  <dd>{{ selectedItem.openTime }}</dd>
                </div>
                <div v-if="selectedItem.phone">
                  <dt><Phone :size="17" /> 電話</dt>
                  <dd>{{ selectedItem.phone }}</dd>
                </div>
              </dl>
              <div v-if="selectedItem.website || selectedItem.mapUrl" class="qr-takeaway">
                <div class="qr-code">
                  <QrcodeVue
                    :value="selectedItem.website || selectedItem.mapUrl"
                    :size="108"
                    level="M"
                    render-as="svg"
                    background="#ffffff"
                    foreground="#071219"
                  />
                </div>
                <div>
                  <strong><QrCode :size="18" /> 掃描帶著走</strong>
                  <span>{{ selectedItem.website ? '用手機開啟地點網站' : '用手機開啟地圖位置' }}</span>
                  <small>離開展場後也能繼續查看</small>
                </div>
              </div>
              <p v-if="selectedItem.imageCredit" class="image-credit">
                影像：{{ selectedItem.imageCredit }}
                <template v-if="selectedItem.imageSourcePlace">｜來源紀錄：{{ selectedItem.imageSourcePlace }}</template>
              </p>
              <small class="detail-source">
                <a :href="selectedItem.sourceUrl" class="source-link" target="_blank" rel="noopener noreferrer">
                  資料：{{ selectedItem.sourceName || '交通部觀光署・景點－觀光資訊資料庫' }}
                </a>
              </small>
            </div>
          </article>
        </div>

        <div
          v-if="selectedRoute"
          class="detail-overlay"
          @click.self="selectedRoute = null"
        >
          <article class="route-detail-panel">
            <button
              class="close-button"
              type="button"
              aria-label="關閉路線"
              @click="selectedRoute = null"
            >
              <X :size="24" />
            </button>
            <div
              class="route-detail-heading"
              :style="{'--route-accent': selectedRoute.accent}"
            >
              <span>{{ selectedRoute.kicker }}</span>
              <h2>{{ selectedRoute.title }}</h2>
              <p>{{ selectedRoute.description }}</p>
              <b><Clock3 :size="16" /> {{ selectedRoute.duration }}</b>
            </div>
            <ol class="route-stops">
              <li
                v-for="(stop, index) in selectedRoute.stops"
                :key="stop.id"
                role="button" tabindex="0"
                @keydown.enter="openStopDetail(stop)"
                @keydown.space.prevent="openStopDetail(stop)"
                @click="openStopDetail(stop)"
              >
                <img
                  :src="stop.image"
                  :alt="stop.imageAlt"
                  referrerpolicy="no-referrer"
                  @error="handleImageError"
                />
                <span class="stop-index">{{
                  String(index + 1).padStart(2, '0')
                }}</span>
                <span
                  ><strong>{{ stop.name }}</strong
                  ><small>{{ stop.town }} · 點擊閱讀介紹</small></span
                >
                <ChevronRight :size="18" />
              </li>
            </ol>
            <small v-if="data" class="route-detail-source">
              <a :href="data.meta.sourceUrl" class="source-link" target="_blank" rel="noopener noreferrer">
                站點資料：交通部觀光署・景點－觀光資訊資料庫
              </a>
            </small>
          </article>
        </div>
      </main>
    </div>
  </div>
</template>
