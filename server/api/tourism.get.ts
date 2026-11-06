import tourism from '../../public/tourism.json'

// Server deployments expose the same snapshot used by the static exhibition.
export default defineEventHandler(() => tourism)
