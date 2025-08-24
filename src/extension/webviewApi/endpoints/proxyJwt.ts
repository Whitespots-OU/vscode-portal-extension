import {window} from 'vscode'

import {ApiError} from 'eco-vue-js/dist/utils/api'

import {apiClient} from '@/extension/api/ApiClient'
import {outputChannel} from '@/extension/utils/OutputChannel'

export const proxyJwt = async () => {
  const response = await apiClient.get('/proxy/jwt/' as never)
    .then(response => {
      outputChannel.appendLine('Successfully connected to LLM server.')
      outputChannel.appendLine(`Response: ${ JSON.stringify(response) }`)

      return response
    })
    .catch(error => {
      outputChannel.appendLine('Failed to connect to LLM server.')
      if (error instanceof ApiError) outputChannel.appendLine(`${ error.name } ${ error.response.status }: ${ error.message }`)

      window.showErrorMessage('Failed to connect to LLM server.')

      return null
    })

  return response?.data
}
