import type {QueryParamsAutovalidatorRule} from '../api/modules/AutovalidatorApi'

import {type Disposable, Uri, commands, window} from 'vscode'

import {AutovalidatorAction} from '@/models/Autovalidator'

import AutovalidatorApi from '../api/modules/AutovalidatorApi'
import {getPortalUrl} from '../models/Settings'
import {CommandName} from '../package'
import {applyDecorationsFinding} from '../providers/DecorationsFinding'
import {treeDataProviderFinding} from '../providers/TreeDataProviderFinding'
import {getGitEmail} from '../utils/GitConfig'
import {outputChannel} from '../utils/OutputChannel'
import WorkspaceState from '../utils/WorkspaceState'

export const commandRejectFindingForever = (): Disposable => {
  return commands.registerCommand(CommandName.REJECT_FINDING_FOREVER, async (findingId: number) => {
    findingId = Number(findingId)

    if (!Number.isInteger(findingId)) {
      window.showErrorMessage('Not a valid finding ID')

      return
    }

    const finding = WorkspaceState.findingList.find(item => item.id === findingId)

    if (!finding) {
      window.showErrorMessage('Finding is not found')

      return
    }

    if (!finding.file_path) {
      window.showErrorMessage('Finding has no file path to create an instruction for')

      return
    }

    const queryParams: QueryParamsAutovalidatorRule = {action_choices: `${ AutovalidatorAction.REJECT }`, search: `"${ finding.name }" "${ finding.file_path }"`}

    const rules = await AutovalidatorApi
      .get(queryParams)
      .catch(() => {
        const message = 'Failed to check validator rules'
        outputChannel.appendLine(message)
        window.showErrorMessage(message)
      })

    if (!rules) {
      outputChannel.appendLine('Failed to get validator rules list')
      return
    }

    const filtered = rules.data.results.filter(item =>
      item.instructions[0]?.field === 'Finding__name' &&
        item.instructions[0]?.value === finding.name && 
        item.instructions[1]?.field === 'Finding__file_path' &&
        item.instructions[1]?.value === finding.file_path,
    )

    if (filtered.length !== 0) {
      const rulesLink = `${ getPortalUrl() }/autovalidator?${ new URLSearchParams(queryParams).toString() }`

      const message = `Found ${ filtered.length } rule${ filtered.length === 1 ? '' : 's' } for this finding`
      outputChannel.appendLine(message)
      window.showErrorMessage(message, 'View Rules').then(selection => {
        if (selection === 'View Rules') commands.executeCommand('vscode.open', Uri.parse(rulesLink))
      })

      return
    }

    const title = `in ${ finding.file_path }`

    outputChannel.appendLine(`Forever reject findings ${ title }`)

    const email = await getGitEmail()

    await AutovalidatorApi
      .create({
        id: undefined as never,
        is_active: true,
        action_choices: AutovalidatorAction.REJECT,
        instructions: [
          {
            id: undefined as never,
            field: 'Finding__name',
            value: finding.name,
            negate: false,
            regex: false,
          },
          {
            id: undefined as never,
            field: 'Finding__file_path',
            value: finding.file_path,
            negate: false,
            regex: false,
          },
        ],
        tags: ['rejected_by_developer', ...(email ? [email] : [])],
        groups: [],
        allow_all_products: true,
        issues_auto_create_on_verify: false,
        affected_products_cluster: null,
        read_only: false,
      })
      .then(response => {
        const url = Uri.parse(`${ getPortalUrl() }/autovalidator/rule/${ response.data.id }`)

        window.showInformationMessage(`Created rule to reject findings ${ title }`, 'View Rule').then(selection => {
          if (selection === 'View Rule') commands.executeCommand('vscode.open', url)
        })

        const length = WorkspaceState.findingList.length

        const filtered = WorkspaceState.findingList.filter(item => item.name !== finding.name || item.file_path !== finding.file_path)

        if (filtered.length !== length) {
          WorkspaceState.findingList = filtered

          outputChannel.appendLine(`Findings count changed from ${ length } to ${ filtered.length }`)

          treeDataProviderFinding.updateList()

          applyDecorationsFinding()
        }

        commands.executeCommand(CommandName.REJECT_FINDING, findingId)
      })
      .catch(() => {
        const message = `Failed to forever reject findings ${ title }`

        outputChannel.appendLine(message)
        window.showErrorMessage(message)
      })
  })
}
