export const RUNNER_PROTOCOL = 'auditor-cli.events/v1'

export type Verdict =
  | 'new'
  | 'known'
  | 'duplicate_in_report'
  | 'auto_rejected'
  | 'auto_verified'
  | 'auto_risk_accepted'
  | 'auto_no_action'

export type RunnerFinding = {
  index: number
  name: string
  description?: string
  severity: string
  file_path: string | null
  line: number | null
  dependency: string | null
  vulnerable_url: string | null
  verdict: Verdict
  finding_id: number | null
  triage_status: string | null
  rule_ids: number[]
  blocking: boolean
  in_changes: boolean
}

export type RunnerEvent =
  | {event: 'plan', protocol: string, name: string, product: string, repository: string, selection: string, jobs: string[], skipped: {job: string, reason: string}[], changed_files: number, run_dir: string}
  | {event: 'image_pull', job: string, image: string}
  | {event: 'job_started', job: string, image: string}
  | {event: 'job_finished', job: string, status: string, exit_code?: number, seconds?: number}
  | {event: 'log', job: string, line: string}
  | {event: 'report', job: string, scan_type: string, path: string, bytes: number}
  | {event: 'findings', job: string, scan_type: string, counts: Record<string, number>, blocking: number, findings: RunnerFinding[] | null}
  | {event: 'warning', job?: string, message: string}
  | {event: 'error', message: string}
  | {event: 'done', status: string, blocking: number, reports_dir: string, reports: number}

export const parseRunnerEvent = (line: string): RunnerEvent | undefined => {
  try {
    const value = JSON.parse(line)

    if (value instanceof Object && typeof value.event === 'string') return value as RunnerEvent
  } catch {
    return undefined
  }
}

const HIDDEN_VERDICTS: Verdict[] = ['auto_rejected', 'duplicate_in_report']

export const isFindingShown = (finding: RunnerFinding): boolean => {
  return finding.in_changes && !HIDDEN_VERDICTS.includes(finding.verdict) && finding.triage_status !== 'rejected'
}

export const verdictTitle = (finding: RunnerFinding): string => {
  const verdict = finding.verdict.replaceAll('_', ' ')

  return finding.triage_status ? `${ verdict }, ${ finding.triage_status }` : verdict
}
