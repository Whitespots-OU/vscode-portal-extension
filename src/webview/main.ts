import {createApp} from 'vue'

import '@web/assets/styles/index.css'
import App from './App.vue'
import {appendDarkMode} from './utils/darkMode'

appendDarkMode()

const app = createApp(App)

app.mount('#app')