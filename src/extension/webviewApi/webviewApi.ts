import {proxyJwt} from './endpoints/proxyJwt'

import {getSettings} from '../models/Settings'

export const webviewApi = {
  getSettings,
  proxyJwt,
  getData: <T>(v: T): T => v,
} as const satisfies Record<string, (arg?: unknown) => unknown>