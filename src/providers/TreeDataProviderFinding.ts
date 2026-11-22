import {type Command, type Event, EventEmitter, Range, ThemeColor, ThemeIcon, type TreeDataProvider, TreeItem, TreeItemCollapsibleState, Uri, window} from 'vscode'

import WorkspaceState from '@/utils/WorkspaceState'

import {type Finding, getFindingAbsolutePath} from '@/models/Finding'
import {type Severity, severityEmojiMap, severityTitleMap} from '@/models/Severity'
import {triageStatusTitleMap} from '@/models/TriageStatus'
import {CommandName, ViewName} from '@/package'
import {type LocalScanFinding, LocalScanStatus, compareLocalFindings, localFindingIds, localScan, onDidChangeLocalScan} from '@/runner/LocalScanResults'
import {verdictTitle} from '@/runner/RunnerEvents'
import {getFindingHoverMessage, getLocalFindingHoverMessage} from '@/utils/FindingMessage'

enum Section {
  LOCAL = 'local',
  PORTAL = 'portal',
}

type Node =
  | {kind: 'section', section: Section}
  | {kind: 'file', section: Section.LOCAL, path: string, findings: LocalScanFinding[]}
  | {kind: 'file', section: Section.PORTAL, path: string, findings: Finding[]}
  | {kind: 'local', finding: LocalScanFinding}
  | {kind: 'portal', finding: Finding}
  | {kind: 'scan'}
  | {kind: 'progress'}
  | {kind: 'clean'}

const openAt = (uri: Uri, line: number | null): Command => ({
  command: 'vscode.open',
  title: 'Open file',
  arguments: [uri, ...(line === null ? [] : [{selection: new Range(line - 1, 0, line - 1, 0)}])],
})

const getCommandFindingOpen = (value: Finding): Command | undefined => {
  const filePath = getFindingAbsolutePath(value)

  return filePath === null ? undefined : openAt(Uri.file(filePath), value.line)
}

const getCommandLocalFindingOpen = (value: LocalScanFinding): Command | undefined => {
  if (!localScan.root || !value.file_path) return undefined

  return openAt(Uri.joinPath(localScan.root, value.file_path), value.line)
}

const groupByPath = <T>(list: T[], path: (item: T) => string | null): Record<string, T[]> => {
  return list.reduce<Record<string, T[]>>((result, current) => {
    const key = path(current)

    if (key !== null) (result[key] ??= []).push(current)

    return result
  }, {})
}

const sortedPaths = (group: Record<string, unknown[]>): string[] => {
  return Object.keys(group).sort((a, b) => a > b ? 1 : a < b ? -1 : 0)
}

const severityLabel = (severity: Severity): string => `${ severityEmojiMap[severity] } ${ severityTitleMap[severity] }`

const findingDescription = (line: number | null, severity: Severity, ...details: string[]): string => {
  return [...(line === null ? [] : [`L${ line }`]), severityLabel(severity), ...details].join(' · ')
}

const comparePortalFindings = (a: Finding, b: Finding): number => b.severity - a.severity || (a.line ?? 0) - (b.line ?? 0)

const progressLabel = (): string => {
  if (!localScan.jobs) return 'Preparing'

  return `Scanning, ${ localScan.finished } of ${ localScan.jobs } jobs done`
}

const localFindingIcon = (finding: LocalScanFinding): ThemeIcon => {
  if (finding.blocking) return new ThemeIcon('error', new ThemeColor('list.errorForeground'))
  if (finding.verdict === 'known') return new ThemeIcon('info')

  return new ThemeIcon('warning', new ThemeColor('list.warningForeground'))
}

const localSectionDescription = (): string => {
  const count = localScan.findings.length
  const blocking = localScan.blocking ? `, ${ localScan.blocking } blocking` : ''

  switch (localScan.status) {
    case LocalScanStatus.IDLE:
      return 'not scanned'
    case LocalScanStatus.RUNNING:
      return `scanning${ count ? ` · ${ count }${ blocking }` : '' }`
    case LocalScanStatus.FAILED:
      return `scan failed${ count ? ` · ${ count }${ blocking }` : '' }`
    case LocalScanStatus.DONE:
      return `${ count }${ blocking } · ${ localScan.finishedAt?.toLocaleTimeString() ?? '' }`
  }
}

const expandedElements = new Set<string>([Section.LOCAL, Section.PORTAL])

const nodeId = (node: Node): string | undefined => {
  if (node.kind === 'section') return node.section
  if (node.kind === 'file') return `${ node.section }:${ node.path }`
}

const collapsible = (node: Node): TreeItemCollapsibleState => {
  return expandedElements.has(nodeId(node) ?? '') ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed
}

class TreeDataProviderFinding implements TreeDataProvider<Node> {
  private _onDidChangeTreeData: EventEmitter<Node | undefined | void> = new EventEmitter<Node | undefined | void>()
  readonly onDidChangeTreeData: Event<Node | undefined | void> = this._onDidChangeTreeData.event

  public groupList: Record<string, Finding[]> = {}

  constructor() {
    onDidChangeLocalScan(() => this.refresh())
  }

  public updateList() {
    this.groupList = groupByPath(WorkspaceState.findingList, item => item.file_path)

    this.updateHeader()
  }

  public updateHeader() {
    setMessage(undefined)

    this._onDidChangeTreeData.fire()
  }

  private refresh() {
    viewFindings.badge = localScan.blocking ? {value: localScan.blocking, tooltip: `${ localScan.blocking } blocking in your changes`} : undefined

    this._onDidChangeTreeData.fire()
  }

  private portalCount(): number {
    return Object.values(this.groupList).reduce((result, current) => result + current.length, 0)
  }

  getTreeItem(node: Node): TreeItem {
    switch (node.kind) {
      case 'section': {
        const local = node.section === Section.LOCAL
        const item = new TreeItem(local ? 'In your changes' : 'Portal', collapsible(node))

        item.id = node.section
        item.iconPath = new ThemeIcon(local ? 'git-commit' : 'cloud')
        item.description = local ? localSectionDescription() : `${ this.portalCount() } / ${ WorkspaceState.findingsCount }`
        item.tooltip = local ? 'auditor-cli results for your uncommitted changes, checked against the portal' : 'Findings the portal has for this repository'

        return item
      }
      case 'file': {
        const item = new TreeItem(node.path, collapsible(node))

        const blocking = node.section === Section.LOCAL ? node.findings.filter(finding => finding.blocking).length : 0

        item.id = nodeId(node)

        item.description = blocking ? `${ node.findings.length } · ${ blocking } blocking` : String(node.findings.length)
        item.resourceUri = Uri.file(node.path)
        item.iconPath = ThemeIcon.File

        return item
      }
      case 'local': {
        const {finding} = node
        const item = new TreeItem(finding.name)
        const portalFinding = WorkspaceState.findingList.find(value => value.id === finding.finding_id)

        item.iconPath = localFindingIcon(finding)
        item.description = findingDescription(finding.line, finding.severityLevel, verdictTitle(finding), ...(finding.blocking ? ['blocking'] : []))
        item.tooltip = getLocalFindingHoverMessage(finding, portalFinding)
        item.command = getCommandLocalFindingOpen(finding)

        return item
      }
      case 'portal': {
        const {finding} = node
        const item = new TreeItem(finding.name)

        item.description = findingDescription(finding.line, finding.severity, triageStatusTitleMap[finding.current_sla_level], ...(localFindingIds().has(finding.id) ? ['in your changes'] : []))
        item.tooltip = getFindingHoverMessage(finding, false)
        item.command = getCommandFindingOpen(finding)

        return item
      }
      case 'scan': {
        const failed = localScan.status === LocalScanStatus.FAILED
        const item = new TreeItem(failed ? 'Scan failed' : 'Scan your changes')

        item.iconPath = failed ? new ThemeIcon('error', new ThemeColor('list.errorForeground')) : new ThemeIcon('play')
        item.description = failed ? 'show log' : undefined
        item.tooltip = localScan.error
        item.command = failed
          ? {command: CommandName.SHOW_RUNNER_LOG, title: 'Show local scan log'}
          : {command: CommandName.SCAN_CHANGES, title: 'Scan changes locally'}

        return item
      }
      case 'progress': {
        const item = new TreeItem(progressLabel())

        item.iconPath = new ThemeIcon('sync~spin')
        item.description = localScan.step ?? localScan.running.join(', ')
        item.tooltip = 'Show the auditor-cli log'
        item.command = {command: CommandName.SHOW_RUNNER_LOG, title: 'Show local scan log'}

        return item
      }
      case 'clean': {
        const item = new TreeItem('No findings in your changes')

        item.iconPath = new ThemeIcon('pass', new ThemeColor('testing.iconPassed'))

        return item
      }
    }
  }

  getChildren(node?: Node): Node[] {
    if (!node) return [{kind: 'section', section: Section.LOCAL}, {kind: 'section', section: Section.PORTAL}]

    switch (node.kind) {
      case 'section':
        return node.section === Section.LOCAL ? this.localChildren() : this.portalChildren()
      case 'file':
        return node.section === Section.LOCAL
          ? [...node.findings].sort(compareLocalFindings).map(finding => ({kind: 'local', finding}))
          : [...node.findings].sort(comparePortalFindings).map(finding => ({kind: 'portal', finding}))
      default:
        return []
    }
  }

  private localChildren(): Node[] {
    const group = groupByPath(localScan.findings, finding => finding.file_path)
    const files: Node[] = sortedPaths(group).map(path => ({kind: 'file', section: Section.LOCAL, path, findings: group[path]}))
    switch (localScan.status) {
      case LocalScanStatus.IDLE:
        return [{kind: 'scan'}]
      case LocalScanStatus.RUNNING:
        return [{kind: 'progress'}, ...files]
      case LocalScanStatus.FAILED:
        return [{kind: 'scan'}, ...files]
      case LocalScanStatus.DONE:
        return files.length ? files : [{kind: 'clean'}]
    }
  }

  private portalChildren(): Node[] {
    return sortedPaths(this.groupList).map(path => ({kind: 'file', section: Section.PORTAL, path, findings: this.groupList[path]}))
  }
}

export const treeDataProviderFinding = new TreeDataProviderFinding()

const viewFindings = window.createTreeView(ViewName.FINDINGS, {
  treeDataProvider: treeDataProviderFinding,
})

viewFindings.onDidExpandElement(e => {
  const id = nodeId(e.element)

  if (id) expandedElements.add(id)
})

viewFindings.onDidCollapseElement(e => {
  const id = nodeId(e.element)

  if (id) expandedElements.delete(id)
})

let interval: NodeJS.Timeout | null = null

export const stopLoading = () => {
  if (interval) clearInterval(interval)
}

export const setLoading = () => {
  stopLoading()

  const message = 'Loading '
  let counter = 1

  interval = setInterval(() => {
    viewFindings.message = message + '.'.repeat(counter)
    if (counter < 3) counter++
    else counter = 1
  }, 300)
}

export const setMessage = (value: string | undefined) => {
  stopLoading()

  viewFindings.message = value
}

export const showErrorMessage = (text: string) => {
  window.showErrorMessage(text)

  setMessage(text)
}
