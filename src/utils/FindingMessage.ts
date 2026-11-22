import type {Finding} from '@/models/Finding'
import type {LocalScanFinding} from '@/runner/LocalScanResults'

import {MarkdownString} from 'vscode'

import {dateFormat} from 'eco-vue-js/dist/utils/dateTime'

import {getPortalUrl} from '@/models/Settings'
import {severityEmojiMap, severityTitleMap} from '@/models/Severity'
import {TriageStatus, triageStatusTitleMap} from '@/models/TriageStatus'
import {CommandName} from '@/package'
import {verdictTitle} from '@/runner/RunnerEvents'

import ButtonReject from '../../assets/ButtonReject.svg'
import ButtonRejectForever from '../../assets/ButtonRejectForever.svg'

const findingFieldTitleMap = {
  id: 'ID',
  current_sla_level: 'Status',
  cvss: 'CVSS',
  date_created: 'Created',
  date_verified: 'Verified',
} as const satisfies Partial<Record<keyof Finding, string>>

const findingFieldDetailList: (keyof typeof findingFieldTitleMap)[] = [
  'current_sla_level',
  'cvss',
  'date_verified',
]

const findingFieldGetterMap = {
  id: value => value.id.toString(),
  current_sla_level: value => triageStatusTitleMap[value.current_sla_level],
  cvss: value => value.cvss?.['4.0']?.score?.toString() ?? value.cvss?.['3.1']?.score?.toString() ?? 'N / A',
  date_created: value => value.date_created ? dateFormat(new Date(value.date_created)) : 'N / A',
  date_verified: value => value.date_verified ? dateFormat(new Date(value.date_verified)) : 'N / A',
} as const satisfies Partial<Record<keyof Finding, (value: Finding) => string>>

export const getFindingHoverMessage = (value: Finding, outdated: boolean, prefix: string = '') => {
  const hoverMessage = new MarkdownString()

  const url = `[${ value.id }](${ getPortalUrl() }/products/${ value.product }/findings/${ value.id })`

  hoverMessage.appendMarkdown(`## ${ prefix }${ url }: ${ severityEmojiMap[value.severity] } ${ severityTitleMap[value.severity] } - ${ value.name }${ outdated ? ' (possibly outdated)' : '' }\n\n`)

  const buttons: string[] = []

  if (value.current_sla_level !== TriageStatus.REJECTED) {
    const commandUriReject = `command:${ CommandName.REJECT_FINDING }?${ encodeURIComponent(JSON.stringify(value.id)) }`
    buttons.push(`[![Reject finding](${ ButtonReject })](${ commandUriReject } "Reject this finding")`)
  }

  if (value.file_path) {
    const commandUriRejectForever = `command:${ CommandName.REJECT_FINDING_FOREVER }?${ encodeURIComponent(JSON.stringify(value.id)) }`
    buttons.push(`[![Reject finding forever](${ ButtonRejectForever })](${ commandUriRejectForever } "Reject all findings with this name and file path")`)
  }

  hoverMessage.appendMarkdown(`${ buttons.join('  ') }\n\n`)

  hoverMessage.isTrusted = true

  hoverMessage.appendMarkdown(`${ value.file_path }:${ value.line }\n\n`)

  hoverMessage.appendMarkdown('Code snippet:\n\n')

  hoverMessage.appendCodeblock(value.line_text, value.language)

  hoverMessage.appendMarkdown(value.description)

  hoverMessage.appendMarkdown('\n\n')

  findingFieldDetailList.forEach((field, index, array) => {
    hoverMessage.appendMarkdown(findingFieldTitleMap[field] + ': ' + findingFieldGetterMap[field](value) + (index < array.length - 1 ? '\n\n' : ''))
  })

  return hoverMessage
}
const verdictLine = (value: LocalScanFinding): string => {
  const verdict = verdictTitle(value)

  if (value.finding_id === null) return verdict

  return `${ verdict } · [portal finding ${ value.finding_id }](${ getPortalUrl() }/findings/${ value.finding_id })`
}

export const getLocalFindingHoverMessage = (value: LocalScanFinding, portalFinding: Finding | undefined, prefix: string = '') => {
  const hoverMessage = new MarkdownString()

  hoverMessage.isTrusted = true

  hoverMessage.appendMarkdown(`## ${ prefix }${ severityEmojiMap[value.severityLevel] } ${ severityTitleMap[value.severityLevel] } - ${ value.name }\n\n`)
  hoverMessage.appendMarkdown(`${ value.blocking ? '**Blocking** · ' : '' }In your changes · ${ value.scanType }\n\n`)
  hoverMessage.appendMarkdown(`${ verdictLine(value) }\n\n`)

  if (value.dependency) hoverMessage.appendMarkdown(`Dependency: \`${ value.dependency }\`\n\n`)

  if (portalFinding) {
    hoverMessage.appendMarkdown('---\n\n')
    hoverMessage.appendMarkdown(getFindingHoverMessage(portalFinding, false).value)
  } else if (value.description) {
    hoverMessage.appendMarkdown('---\n\n')
    hoverMessage.appendMarkdown(value.description)
  }

  return hoverMessage
}
