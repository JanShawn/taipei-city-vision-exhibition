import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  buildDir: '.nuxt',
  compatibilityDate: '2025-07-15',
  devtools: {enabled: false},
  ssr: false,
  css: ['~/assets/css/main.css', '~/assets/css/hero.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: {lang: 'zh-Hant'},
      title: '台北・城市探索指南',
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
        },
        {
          name: 'theme-color',
          content: '#050d15',
        },
      ],
    },
  },
})
