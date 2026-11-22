import {Uri} from 'vscode'

import {createHash} from 'crypto'
import {chmod, mkdir, readFile, rename, writeFile} from 'fs/promises'

import {getPortalUrl, getSettings} from '@/models/Settings'
import {context} from '@/utils/Context'
import {outputChannel} from '@/utils/OutputChannel'

const MANIFEST_PATH = '/api/v1/local-scan/cli/'

type RunnerBuild = {
  os: string
  arch: string
  name: string
  sha256: string
  size: number
  path: string
}

type RunnerManifest = {
  version: string
  files: RunnerBuild[]
}

const PLATFORM_OS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'windows',
}

const ARCH: Partial<Record<NodeJS.Architecture, string>> = {
  x64: 'amd64',
  arm64: 'arm64',
}

const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex')

const fetchManifest = async (portalUrl: string): Promise<RunnerManifest> => {
  const response = await fetch(portalUrl + MANIFEST_PATH)

  if (response.status === 404) throw new Error('This portal does not serve auditor-cli; update the portal.')
  if (!response.ok) throw new Error(`Failed to read the auditor-cli manifest: ${ response.status } ${ response.statusText }`)

  return await response.json() as RunnerManifest
}

const findBuild = (manifest: RunnerManifest): RunnerBuild => {
  const os = PLATFORM_OS[process.platform]
  const arch = ARCH[process.arch]
  const build = manifest.files.find(item => item.os === os && item.arch === arch)

  if (!build) throw new Error(`The portal has no auditor-cli build for ${ process.platform }/${ process.arch }.`)

  return build
}

const runnerUri = (build: RunnerBuild): Uri => {
  return Uri.joinPath(context.globalStorageUri, 'auditor-cli', build.os === 'windows' ? 'auditor-cli.exe' : 'auditor-cli')
}

const installedChecksum = async (path: string): Promise<string | undefined> => {
  return readFile(path).then(sha256).catch(() => undefined)
}

const download = async (portalUrl: string, build: RunnerBuild, path: string) => {
  outputChannel.appendLine(`Downloading auditor-cli ${ build.os }/${ build.arch } from ${ portalUrl }`)

  const response = await fetch(portalUrl + build.path)

  if (!response.ok) throw new Error(`Failed to download auditor-cli: ${ response.status } ${ response.statusText }`)

  const data = new Uint8Array(await response.arrayBuffer())

  if (sha256(data) !== build.sha256) throw new Error('The downloaded auditor-cli does not match the portal\'s checksum.')

  const temporary = `${ path }.download`

  await writeFile(temporary, data)
  await chmod(temporary, 0o755)
  await rename(temporary, path)
}

let installing: Promise<string> | undefined

const install = async (): Promise<string> => {
  const portalUrl = getPortalUrl()

  if (!portalUrl) throw new Error('Portal URL is not set.')

  const manifest = await fetchManifest(portalUrl)
  const build = findBuild(manifest)
  const uri = runnerUri(build)

  if (await installedChecksum(uri.fsPath) === build.sha256) return uri.fsPath

  await mkdir(Uri.joinPath(uri, '..').fsPath, {recursive: true})
  await download(portalUrl, build, uri.fsPath)

  outputChannel.appendLine(`Installed auditor-cli ${ manifest.version } at ${ uri.fsPath }`)

  return uri.fsPath
}

export const ensureRunner = (): Promise<string> => {
  const override = getSettings().runner.path

  if (override) return Promise.resolve(override)

  installing ??= install().finally(() => {
    installing = undefined
  })

  return installing
}
