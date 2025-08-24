import {type RouteRecordRaw, createRouter, createWebHashHistory} from 'vue-router'

import {RouteName} from '../utils/RouteName'

// const ROUTE_STORAGE_KEY = 'webview_current_route'

export const routes = [
  {
    path: '/',
    redirect: {name: RouteName.CHAT_LIST},
    children: [
      {
        path: 'chat-list/:chatId?',
        name: RouteName.CHAT_LIST,
        component: () => import('@web/views/Chat/ChatListView.vue'),
      },
      {
        path: 'unauthorized',
        name: RouteName.UNAUTHORIZED,
        component: () => import('@web/views/Unathorized/UnathorizedView.vue'),
      },
    ],
  },
] as const satisfies RouteRecordRaw[]

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior(to, from) {
    if (to.name === from.name) return

    return {top: 0}
  },
  routes,
})

// router.afterEach((to) => {
//   chrome.storage.local.set({[ROUTE_STORAGE_KEY]: {name: to.name, params: to.params, query: to.query}})
// })

export default router