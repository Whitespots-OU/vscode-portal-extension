import {ApiClientInstance, updateExpirationDate} from 'eco-vue-js/dist/utils/ApiClient'
import {addDay} from 'eco-vue-js/dist/utils/dateTime'

import {RouteName} from '@web/utils/RouteName'

import {apiWebview} from './ApiWebview'

let token: string | null = null

export const tokenRefresh = async () => {
  const response = await apiWebview.proxyJwt()

  token = null

  console.log('Refreshed JWT:', response)

  updateExpirationDate(addDay(new Date(), 1))
}

const createApiClient = async () => {
  const settings = await apiWebview.getSettings()
  const baseUrl = settings.base.url
  const finalUrl = baseUrl ? (baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl) : ''

  await tokenRefresh()
  
  return new ApiClientInstance({
    routeNameAuth: RouteName.CHAT_LIST,
    routeNameAuthNo: RouteName.UNAUTHORIZED,
    baseUrl: (finalUrl ? `${ finalUrl }/api/v1` : '/api/v1') as `/${ string }`,
    tokenRefresh,
    tokenGetter: () => token,
    credentials: import.meta.env.DEV ? 'include' : 'same-origin',
  })
}

export const apiClient = await createApiClient()
