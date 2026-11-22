import {type DecorationOptions, DecorationRangeBehavior, MarkdownString, type TextEditor, window, workspace} from 'vscode'

import {type Finding} from '@/models/Finding'
import {getSettings} from '@/models/Settings'
import {Severity, severityList} from '@/models/Severity'
import {severityDecorationMap} from '@/models/SeverityDecoration'
import {type LocalScanFinding, localFindingsInFile, onDidChangeLocalScan} from '@/runner/LocalScanResults'
import {getFindingHoverMessage, getLocalFindingHoverMessage} from '@/utils/FindingMessage'
import {outputChannel} from '@/utils/OutputChannel'
import severityColors from '@/utils/severity'

import {treeDataProviderFinding} from './TreeDataProviderFinding'

const severityKeyMap: Record<Severity, keyof typeof severityColors> = {
  [Severity.INFO]: 'info',
  [Severity.LOW]: 'low',
  [Severity.MEDIUM]: 'medium',
  [Severity.HIGH]: 'high',
  [Severity.CRITICAL]: 'critical',
}

const changedLineDecorationMap = severityList.reduce<Record<Severity, ReturnType<typeof window.createTextEditorDecorationType>>>((result, current) => {
  result[current] = window.createTextEditorDecorationType({
    isWholeLine: false,
    before: {
      contentText: '●',
      color: severityColors[severityKeyMap[current]].text,
      margin: '0 -8px 0 0',
    },
    rangeBehavior: DecorationRangeBehavior.OpenClosed,
  })

  return result
}, {} as Record<Severity, ReturnType<typeof window.createTextEditorDecorationType>>)

const resetDecorations = () => {
  const editor = window.activeTextEditor
  if (!editor) return

  severityList.forEach(severity => {
    editor.setDecorations(severityDecorationMap[severity], [])
    editor.setDecorations(changedLineDecorationMap[severity], [])
  })
}

type LineEntry = {
  severity: Severity
  outdated: boolean
  message: (prefix: string) => MarkdownString
}

const compareEntries = (a: LineEntry, b: LineEntry): number => b.severity - a.severity

const portalEntries = (findings: Finding[], editor: TextEditor, merged: Set<number>): Map<number, LineEntry[]> => {
  const result = new Map<number, LineEntry[]>()

  for (const finding of findings) {
    if (finding.line === null || merged.has(finding.id) || finding.line > editor.document.lineCount) continue

    const outdated = editor.document.lineAt(finding.line - 1).text !== finding.line_text

    result.set(finding.line, [...result.get(finding.line) ?? [], {
      severity: finding.severity,
      outdated,
      message: prefix => getFindingHoverMessage(finding, outdated, prefix),
    }])
  }

  return result
}

const addLocalEntries = (result: Map<number, LineEntry[]>, findings: LocalScanFinding[], portalFindings: Finding[], editor: TextEditor) => {
  for (const finding of findings) {
    if (finding.line === null || finding.line > editor.document.lineCount) continue

    const portalFinding = portalFindings.find(item => item.id === finding.finding_id)

    result.set(finding.line, [...result.get(finding.line) ?? [], {
      severity: finding.severityLevel,
      outdated: false,
      message: prefix => getLocalFindingHoverMessage(finding, portalFinding, prefix),
    }])
  }
}

const emptyBySeverity = (): Record<Severity, DecorationOptions[]> => ({
  [Severity.INFO]: [],
  [Severity.LOW]: [],
  [Severity.MEDIUM]: [],
  [Severity.HIGH]: [],
  [Severity.CRITICAL]: [],
})

export const applyDecorationsFinding = () => {
  const editor = window.activeTextEditor

  if (!editor) return

  const path = workspace.asRelativePath(editor.document.uri, false)
  const portalFindings = treeDataProviderFinding.groupList[path] ?? []
  const localFindings = localFindingsInFile(path)

  if (!getSettings().personalization.highlight || (!portalFindings.length && !localFindings.length)) {
    resetDecorations()
    return
  }

  const entries = portalEntries(portalFindings, editor, new Set(localFindings.flatMap(item => item.finding_id ?? [])))

  addLocalEntries(entries, localFindings, portalFindings, editor)

  const decorationsBySeverity = emptyBySeverity()
  const changedDecorationsBySeverity = emptyBySeverity()

  for (const [line, list] of entries) {
    const sorted = list.sort(compareEntries)
    const message = new MarkdownString()

    message.isTrusted = true

    sorted.forEach((entry, index) => {
      if (index) message.appendMarkdown('\n\n---\n\n')
      message.appendMarkdown(entry.message(sorted.length > 1 ? `(${ index + 1 } / ${ sorted.length }) ` : '').value)
    })

    const target = sorted[0].outdated ? changedDecorationsBySeverity : decorationsBySeverity

    target[sorted[0].severity].push({range: editor.document.lineAt(line - 1).range, hoverMessage: message})
  }

  outputChannel.appendLine(`Applying finding decorations for file ${ path }`)

  severityList.forEach(severity => {
    editor.setDecorations(severityDecorationMap[severity], decorationsBySeverity[severity])
    editor.setDecorations(changedLineDecorationMap[severity], changedDecorationsBySeverity[severity])
  })
}

onDidChangeLocalScan(applyDecorationsFinding)
