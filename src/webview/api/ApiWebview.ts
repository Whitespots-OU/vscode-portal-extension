import type {WebviewAPI, WebviewAPIResponse} from '@/extension/webviewApi/types'

import {ApiError} from 'eco-vue-js/dist/utils/api'

import {ResponseStatus} from '@/utils/ResponseStatus'

const apiItems = {
  getSettings: true,
  proxyJwt: true,
  getData: true,
} as const satisfies Record<keyof WebviewAPI, true>

type ParentProcess = {postMessage: (msg: unknown) => void}

declare let acquireVsCodeApi: (() => ParentProcess) | undefined

let parent: ParentProcess | null = null

if (typeof acquireVsCodeApi !== 'undefined') parent = acquireVsCodeApi?.()

if (!parent) throw new Error('Not running inside a VS Code Webview')

const handler = <T extends keyof WebviewAPI>(command: T, data: Parameters<WebviewAPI[T]>[0]) => {
  return new Promise<ReturnType<WebviewAPI[T]>>((resolve) => {

    const listener = (event: MessageEvent<WebviewAPIResponse<T>>) => {
      const message = event.data
      if (message.command === command && 'response' in message) {
        window.removeEventListener('message', listener)

        resolve(message.response)

        clearTimeout(timeout)
      }
    }

    const timeout = setTimeout(() => {
      window.removeEventListener('message', listener)

      throw new ApiError({status: ResponseStatus.TIMED_OUT, data: {detail: 'Request Timeout'}, request: {} as never})
    }, 60000)

    window.addEventListener('message', listener)

    parent.postMessage({command, data})
  })
}

export const apiWebview = new Proxy(apiItems, {
  get: (target, prop: keyof typeof apiItems) => {
    if (prop in target) {
      return (data: Parameters<WebviewAPI[typeof prop]>[0]) => handler(prop, data)
    }

    throw new Error(`ApiClient has no method ${ String(prop) }`)
  },
}) as unknown as {
  [K in keyof typeof apiItems]: Parameters<WebviewAPI[K]>[0] extends undefined
    ? () => Promise<ReturnType<WebviewAPI[K]>>
    : (data: Parameters<WebviewAPI[K]>[0]) => Promise<ReturnType<WebviewAPI[K]>>
}
