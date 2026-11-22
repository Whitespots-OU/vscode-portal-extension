import {type CancellationToken, type Progress, ProgressLocation, StatusBarAlignment, type WorkspaceFolder, commands, window, workspace} from 'vscode'

import {spawn} from 'child_process'
import {createInterface} from 'readline'

import {getPortalUrl, getSettings} from '@/models/Settings'
import {CommandName} from '@/package'
import {outputChannel} from '@/utils/OutputChannel'

import {addFindingDiagnostics, localScanDiagnostics} from './LocalScanDiagnostics'
import {RUNNER_PROTOCOL, type RunnerEvent, parseRunnerEvent} from './RunnerEvents'
import {ensureRunner} from './RunnerInstaller'

export enum ScanSelection {
  CHANGES = 'changes',
  STAGED = 'staged',
}

const EXIT_BLOCKING = 1

const runnerLog = window.createOutputChannel('auditor-cli', 'log')

const statusBar = window.createStatusBarItem(StatusBarAlignment.Left)
statusBar.command = CommandName.SCAN_CHANGES

const showStatus = (text: string, tooltip: string) => {
  statusBar.text = text
  statusBar.tooltip = tooltip
  statusBar.show()
}

const runnerEnv = (): NodeJS.ProcessEnv => {
  return {
    ...process.env,
    AUDITOR_CLI_URL: getPortalUrl(),
    AUDITOR_CLI_TOKEN: getSettings().base.token,
  }
}

const findWorkspaceFolder = (): WorkspaceFolder | undefined => {
  const active = window.activeTextEditor?.document.uri

  return (active && workspace.getWorkspaceFolder(active)) || workspace.workspaceFolders?.[0]
}

type ScanResult = {
  exitCode: number | null
  blocking: number
  errors: string[]
}

const handleEvent = (folder: WorkspaceFolder, event: RunnerEvent, result: ScanResult, progress: Progress<{message?: string}>) => {
  switch (event.event) {
    case 'plan':
      if (event.protocol !== RUNNER_PROTOCOL) runnerLog.appendLine(`Unexpected runner protocol ${ event.protocol }`)
      runnerLog.appendLine(`${ event.name } · ${ event.product } (${ event.repository }): ${ event.jobs.length } jobs, ${ event.changed_files } changed files`)
      event.skipped.forEach(item => runnerLog.appendLine(`skip ${ item.job }: ${ item.reason }`))
      break
    case 'image_pull':
      progress.report({message: `pulling ${ event.image }`})
      break
    case 'job_started':
      progress.report({message: event.job})
      showStatus(`$(sync~spin) ${ event.job }`, 'auditor-cli is scanning')
      runnerLog.appendLine(`▶ ${ event.job }`)
      break
    case 'job_finished':
      runnerLog.appendLine(`${ event.job } ${ event.status } in ${ Math.round(event.seconds ?? 0) }s`)
      break
    case 'log':
      runnerLog.appendLine(`[${ event.job }] ${ event.line }`)
      break
    case 'report':
      progress.report({message: `checking ${ event.scan_type }`})
      break
    case 'findings':
      addFindingDiagnostics(folder.uri, event.scan_type, event.findings)
      runnerLog.appendLine(`check ${ event.scan_type }: ${ JSON.stringify(event.counts) }, ${ event.blocking } blocking`)
      break
    case 'warning':
      runnerLog.appendLine(`! ${ event.message }`)
      break
    case 'error':
      result.errors.push(event.message)
      runnerLog.appendLine(`error: ${ event.message }`)
      break
    case 'done':
      result.blocking = event.blocking
      runnerLog.appendLine(`${ event.status }: ${ event.reports } reports in ${ event.reports_dir }`)
      break
  }
}

const runScan = (runner: string, folder: WorkspaceFolder, selection: ScanSelection, progress: Progress<{message?: string}>, token: CancellationToken) => {
  return new Promise<ScanResult>((resolve, reject) => {
    const args = ['run', '--json', ...(selection === ScanSelection.STAGED ? ['--staged'] : [])]
    const child = spawn(runner, args, {cwd: folder.uri.fsPath, env: runnerEnv()})
    const result: ScanResult = {exitCode: null, blocking: 0, errors: []}

    token.onCancellationRequested(() => child.kill())

    createInterface({input: child.stdout}).on('line', line => {
      const event = parseRunnerEvent(line)

      if (event) handleEvent(folder, event, result, progress)
      else runnerLog.appendLine(line)
    })

    createInterface({input: child.stderr}).on('line', line => runnerLog.appendLine(line))

    child.on('error', reject)
    child.on('close', code => {
      result.exitCode = code
      resolve(result)
    })
  })
}

const reportResult = (result: ScanResult) => {
  if (result.exitCode === 0) {
    showStatus('$(shield) clean', 'auditor-cli: no blocking findings in your changes')
    return
  }

  if (result.exitCode === EXIT_BLOCKING) {
    showStatus(`$(error) ${ result.blocking } blocking`, 'auditor-cli: blocking findings in your changes')
    window.showWarningMessage(`${ result.blocking } blocking finding${ result.blocking === 1 ? '' : 's' } in your changes`, 'Show Problems')
      .then(selection => {
        if (selection) commands.executeCommand('workbench.actions.view.problems')
      })
    return
  }

  showStatus('$(warning) scan failed', result.errors.join('\n') || 'auditor-cli failed')
  window.showErrorMessage(`Local scan failed: ${ result.errors.at(-1) ?? `auditor-cli exited with ${ result.exitCode }` }`, 'Show Log')
    .then(selection => {
      if (selection) runnerLog.show()
    })
}

let running = false

export const scanLocally = async (selection: ScanSelection) => {
  if (running) {
    window.showInformationMessage('A local scan is already running')
    return
  }

  const folder = findWorkspaceFolder()

  if (!folder) {
    window.showErrorMessage('No opened workspace folders.')
    return
  }

  running = true

  await window.withProgress(
    {location: ProgressLocation.Notification, title: selection === ScanSelection.STAGED ? 'Scanning staged changes' : 'Scanning changes', cancellable: true},
    async (progress, token) => {
      progress.report({message: 'preparing auditor-cli'})

      const runner = await ensureRunner()

      localScanDiagnostics.clear()
      runnerLog.appendLine(`$ ${ runner } run --json${ selection === ScanSelection.STAGED ? ' --staged' : '' }`)

      reportResult(await runScan(runner, folder, selection, progress, token))
    },
  )
    .then(undefined, (error: Error) => {
      outputChannel.appendLine(`Local scan failed: ${ error.message }`)
      showStatus('$(warning) scan failed', error.message)
      window.showErrorMessage(`Local scan failed: ${ error.message }`)
    })
    .then(() => {
      running = false
    })
}

const runOnce = (runner: string, args: string[], cwd: string, input?: string) => {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(runner, args, {cwd, env: runnerEnv()})
    let output = ''

    child.stdout.on('data', chunk => output += chunk)
    child.stderr.on('data', chunk => output += chunk)
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(output.trim() || `exit ${ code }`)))

    child.stdin.end(input)
  })
}

export const installPreCommitHook = async () => {
  const folder = findWorkspaceFolder()

  if (!folder) {
    window.showErrorMessage('No opened workspace folders.')
    return
  }

  const confirmed = await window.showInformationMessage(
    'Install a pre-commit hook that runs auditor-cli on staged changes? It logs auditor-cli in to the portal with your token, stored in the OS keychain.',
    {modal: true},
    'Install',
  )

  if (!confirmed) return

  try {
    const runner = await ensureRunner()

    runnerLog.appendLine(await runOnce(runner, ['login', '--url', getPortalUrl()], folder.uri.fsPath, getSettings().base.token + '\n'))
    runnerLog.appendLine(await runOnce(runner, ['hook', 'install'], folder.uri.fsPath))

    window.showInformationMessage('Pre-commit hook installed')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    outputChannel.appendLine(`Failed to install the pre-commit hook: ${ message }`)
    window.showErrorMessage(`Failed to install the pre-commit hook: ${ message }`)
  }
}
