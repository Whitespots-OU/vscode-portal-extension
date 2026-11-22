import {EventEmitter, type Uri} from 'vscode'

import {type RunnerFinding, isFindingShown} from './RunnerEvents'

export enum LocalScanStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
}

export type LocalScanFinding = RunnerFinding & {scanType: string}

type LocalScanState = {
  status: LocalScanStatus
  root: Uri | undefined
  job: string | undefined
  error: string | undefined
  blocking: number
  finishedAt: Date | undefined
  findings: LocalScanFinding[]
}

const changed = new EventEmitter<void>()

export const onDidChangeLocalScan = changed.event

export const localScan: LocalScanState = {
  status: LocalScanStatus.IDLE,
  root: undefined,
  job: undefined,
  error: undefined,
  blocking: 0,
  finishedAt: undefined,
  findings: [],
}

export const startLocalScan = (root: Uri) => {
  Object.assign(localScan, {status: LocalScanStatus.RUNNING, root, job: undefined, error: undefined, blocking: 0, finishedAt: undefined, findings: []})
  changed.fire()
}

export const setLocalScanJob = (job: string) => {
  localScan.job = job
  changed.fire()
}

export const addLocalScanFindings = (scanType: string, findings: RunnerFinding[]) => {
  localScan.findings.push(...findings.filter(isFindingShown).map(finding => ({...finding, scanType})))
  localScan.blocking = localScan.findings.filter(finding => finding.blocking).length
  changed.fire()
}

export const finishLocalScan = (error?: string) => {
  Object.assign(localScan, {status: error ? LocalScanStatus.FAILED : LocalScanStatus.DONE, job: undefined, error, finishedAt: new Date()})
  changed.fire()
}

export const localFindingIds = (): Set<number> => {
  return new Set(localScan.findings.flatMap(finding => finding.finding_id === null ? [] : [finding.finding_id]))
}
