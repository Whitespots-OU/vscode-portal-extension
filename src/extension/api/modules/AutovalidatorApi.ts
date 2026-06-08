import type {AutovalidatorAction, AutovalidatorRule} from '@/models/Autovalidator'

import {apiClient} from '../ApiClient'

export type QueryParamsAutovalidatorRule = {
  search?: string
  action_choices?: `${ AutovalidatorAction }`
}

export default {
  get(params: QueryParamsAutovalidatorRule = {}) {
    return apiClient.get<PaginatedResponse<AutovalidatorRule>>('/auto-validator/rules/', {params})
  },

  create(payload: AutovalidatorRule, config?: RequestConfig) {
    return apiClient.post<AutovalidatorRule>('/auto-validator/rules/', payload, config)
  },
}
