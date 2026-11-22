import {EventEmitter, type Uri} from 'vscode'

import {Severity} from '@/models/Severity'

import {type RunnerFinding, isFindingShown} from './RunnerEvents'

export enum LocalScanStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
}

export type LocalScanFinding = RunnerFinding & {scanType: string, severityLevel: Severity}

type LocalScanState = {
  status: LocalScanStatus
  root: Uri | undefined
  step: string | undefined
  jobs: number
  finished: number
  running: string[]
  error: string | undefined
  blocking: number
  finishedAt: Date | undefined
  findings: LocalScanFinding[]
}

const severityLevelMap: Record<string, Severity> = {
  critical: Severity.CRITICAL,
  high: Severity.HIGH,
  medium: Severity.MEDIUM,
  low: Severity.LOW,
  info: Severity.INFO,
}

const changed = new EventEmitter<void>()

export const onDidChangeLocalScan = changed.event

export const localScan: LocalScanState = {
  status: LocalScanStatus.IDLE,
  root: undefined,
  step: undefined,
  jobs: 0,
  finished: 0,
  running: [],
  error: undefined,
  blocking: 0,
  finishedAt: undefined,
  findings: [],
}

const update = (values: Partial<LocalScanState>) => {
  Object.assign(localScan, values)
  changed.fire()
}

export const startLocalScan = (root: Uri) => {
  update({status: LocalScanStatus.RUNNING, root, step: 'preparing auditor-cli', jobs: 0, finished: 0, running: [], error: undefined, blocking: 0, finishedAt: undefined, findings: []})
}

export const setLocalScanStep = (step: string) => update({step})

export const setLocalScanJobs = (jobs: number) => update({jobs, step: undefined})

export const startLocalScanJob = (job: string) => update({running: [...localScan.running, job], step: undefined})

export const finishLocalScanJob = (job: string) => {
  update({running: localScan.running.filter(item => item !== job), finished: localScan.finished + 1})
}

export const addLocalScanFindings = (scanType: string, findings: RunnerFinding[]) => {
  localScan.findings.push(...findings.filter(isFindingShown).map(finding => ({
    ...finding,
    scanType,
    severityLevel: severityLevelMap[finding.severity.toLowerCase()] ?? Severity.INFO,
  })))

  update({blocking: localScan.findings.filter(finding => finding.blocking).length})
}

export const finishLocalScan = (error?: string) => {
  update({status: error ? LocalScanStatus.FAILED : LocalScanStatus.DONE, step: undefined, running: [], error, finishedAt: new Date()})
}

export const localFindingIds = (): Set<number> => {
  return new Set(localScan.findings.flatMap(finding => finding.finding_id === null ? [] : [finding.finding_id]))
}

export const localFindingsInFile = (path: string): LocalScanFinding[] => {
  return localScan.findings.filter(finding => finding.file_path === path)
}

export const compareLocalFindings = (a: LocalScanFinding, b: LocalScanFinding): number => {
  return Number(b.blocking) - Number(a.blocking) || b.severityLevel - a.severityLevel || (a.line ?? 0) - (b.line ?? 0)
}
