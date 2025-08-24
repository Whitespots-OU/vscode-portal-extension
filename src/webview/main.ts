import {VueQueryPlugin} from '@tanstack/vue-query'
import {createApp} from 'vue'

import '@web/assets/styles/index.css'
import App from './App.vue'
import router from './router/router'
import {appendDarkMode} from './utils/darkMode'

appendDarkMode()

const app = createApp(App)

app.use(router)
app.use(VueQueryPlugin)

app.mount('#app')