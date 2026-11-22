import {Diagnostic, DiagnosticSeverity, Position, Range, Uri, languages} from 'vscode'

import {type RunnerFinding, isFindingShown, verdictTitle} from './RunnerEvents'

const SOURCE = 'auditor-cli'

export const localScanDiagnostics = languages.createDiagnosticCollection(SOURCE)

const findingRange = (finding: RunnerFinding): Range => {
  const line = Math.max((finding.line ?? 1) - 1, 0)

  return new Range(new Position(line, 0), new Position(line, Number.MAX_SAFE_INTEGER))
}

const toDiagnostic = (finding: RunnerFinding, scanType: string): Diagnostic => {
  const diagnostic = new Diagnostic(
    findingRange(finding),
    `${ finding.name } [${ finding.severity }, ${ verdictTitle(finding) }]`,
    DiagnosticSeverity.Error,
  )

  diagnostic.source = `${ SOURCE } · ${ scanType }`

  return diagnostic
}

export const addFindingDiagnostics = (root: Uri, scanType: string, findings: RunnerFinding[]) => {
  const byFile = new Map<string, Diagnostic[]>()

  for (const finding of findings) {
    if (!finding.file_path || !finding.blocking || !isFindingShown(finding)) continue

    const uri = Uri.joinPath(root, finding.file_path).toString()

    byFile.set(uri, [...byFile.get(uri) ?? [], toDiagnostic(finding, scanType)])
  }

  for (const [uri, diagnostics] of byFile) {
    const parsed = Uri.parse(uri)

    localScanDiagnostics.set(parsed, [...localScanDiagnostics.get(parsed) ?? [], ...diagnostics])
  }
}
