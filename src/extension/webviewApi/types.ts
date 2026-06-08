import type {webviewApi} from './webviewApi'

export type WebviewAPI = typeof webviewApi

export type WebviewAPIRequest<T extends keyof WebviewAPI> = {command: T, data: Parameters<WebviewAPI[T]>[0]}

export type WebviewAPIResponse<T extends keyof WebviewAPI> = {command: T, data: Parameters<WebviewAPI[T]>[0], response: ReturnType<WebviewAPI[T]>}
