// .blago/config.json: activeEnv, coopname, environments { api_url, chain_url, chain_id, coopname? }.

import type { BlagoGlobalConfigFile } from './global-config.js'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { ensureGlobalBlagoConfigFile, mkdirWorkspaceDirs } from './global-config.js'
import {
  type BlagoAgentHomeRoot,
  copyBundledBlagoAgentHomeBundles,
} from './install-bundled-agent-homes.js'
import { blagoDir, CONFIG_FILE, configPath, gitignorePath } from './paths.js'

export type { BlagoGlobalConfigFile } from './global-config.js'

export type BlagoEnvironmentName = 'dev' | 'testnet' | 'production' | (string & {})

/**
 * Имя кооператива в шаблоне среды (новый config). Поменяйте per-env в .blago/config.json под каждую среду.
 */
export const DEFAULT_COOPNAME = 'voskhod'

export interface BlagoRemoteProfile {
  /** Базовый URL контроллера (как BACKEND_URL у desktop); без суффикса к пути добавится /v1/graphql. */
  readonly api_url: string
  readonly chain_url: string
  readonly chain_id: string
  readonly label?: string
  /** Short name кооператива для этой среды (фильтры Capital / pull). У разных сред может быть разное значение. */
  readonly coopname?: string
  /**
   * Issuer authentik для входа по паролю (CoopID). По умолчанию — origin от
   * api_url (same-origin топология кооператива); поле нужно только средам,
   * где authentik живёт на другом адресе.
   */
  readonly issuer?: string
}

export interface BlagoConfigFile {
  /** Имя активной среды */
  activeEnv: string
  /**
   * Запасной coopname, если у активной среды поле environments.<activeEnv>.coopname пустое (legacy / общий fallback).
   */
  coopname?: string
  environments: Record<string, BlagoRemoteProfile>
}

const DEFAULT_ENVS: Record<string, BlagoRemoteProfile> = {
  dev: {
    api_url: 'http://127.0.0.1:2998',
    chain_url: 'http://127.0.0.1:8888',
    chain_id: 'cae86058a6d8698833afb474ab8a5ad8599c6cf54f9ebcf275dbac7055c16fe1',
    label: 'Локальная разработка',
    coopname: DEFAULT_COOPNAME,
  },
  testnet: {
    api_url: 'https://testnet.coopenomics.world/backend',
    chain_url: 'https://testnet.coopenomics.world/api',
    chain_id: 'f0364a3f9fd913081f1c0b05c6f8f50a59b2ba60bb928cb321ba3a9a36316624',
    label: 'Testnet',
    coopname: DEFAULT_COOPNAME,
  },
  production: {
    api_url: 'https://лк.цифровой-кооператив.рф/backend',
    chain_url: 'https://лк.цифровой-кооператив.рф/api',
    chain_id: '6e37f9ac0f0ea717bfdbf57d1dd5d7f0e2d773227d9659a63bbf86eec0326c1b',
    label: 'Production',
    coopname: DEFAULT_COOPNAME,
  },
}

export function defaultConfig(): BlagoConfigFile {
  return {
    activeEnv: 'dev',
    environments: { ...DEFAULT_ENVS },
  }
}

/** Эффективный coopname: сначала у активной среды, иначе верхний уровень config (fallback). */
export function resolveCoopname(cfg: BlagoConfigFile): string | undefined {
  const profile = cfg.environments[cfg.activeEnv]
  const fromEnv = profile?.coopname?.trim()
  if (fromEnv) {
    return fromEnv
  }
  return cfg.coopname?.trim() || undefined
}

function environmentsWithOptionalCoopname(
  envs: Record<string, BlagoRemoteProfile>,
  coopname: string | undefined,
): Record<string, BlagoRemoteProfile> {
  if (coopname === undefined) {
    return envs
  }
  return Object.fromEntries(
    Object.entries(envs).map(([name, profile]) => [name, { ...profile, coopname }]),
  ) as Record<string, BlagoRemoteProfile>
}

export async function loadConfig(root: string): Promise<BlagoConfigFile> {
  const raw = await fs.readFile(configPath(root), 'utf8')
  const parsed = JSON.parse(raw) as BlagoConfigFile
  if (!parsed.activeEnv || typeof parsed.environments !== 'object') {
    throw new Error('Некорректный config.json: нужны activeEnv и environments')
  }
  return parsed
}

export async function saveConfig(root: string, cfg: BlagoConfigFile): Promise<void> {
  await fs.mkdir(blagoDir(root), { recursive: true })
  await fs.writeFile(configPath(root), `${JSON.stringify(cfg, null, 2)}\n`, 'utf8')
}

const BLAGO_SESSION_GITIGNORE_LINE = 'session.*.json'

const BLAGO_GITIGNORE_SNIPPET = `# Токены blago login — не коммитить в репозиторий
${BLAGO_SESSION_GITIGNORE_LINE}
`

/** Создаёт или дополняет .blago/.gitignore, чтобы не коммитить файлы сессии. */
export async function ensureBlagoGitignore(root: string): Promise<void> {
  const p = gitignorePath(root)
  let existing = ''
  try {
    existing = await fs.readFile(p, 'utf8')
  }
  catch {
    /* файла ещё нет */
  }
  if (existing.includes(BLAGO_SESSION_GITIGNORE_LINE)) {
    return
  }
  const body = existing.trim().length > 0
    ? `${existing.replace(/\s+$/, '')}\n\n${BLAGO_GITIGNORE_SNIPPET}`
    : BLAGO_GITIGNORE_SNIPPET
  await fs.writeFile(p, body.endsWith('\n') ? body : `${body}\n`, 'utf8')
}

export async function initBlagoWorkspace(
  root: string,
  options?: { coopname?: string, force?: boolean, preferredActiveEnv?: string },
): Promise<void> {
  const dir = blagoDir(root)
  const cfgFile = path.join(dir, CONFIG_FILE)
  if (!options?.force && (await fileExists(cfgFile))) {
    await ensureBlagoGitignore(root)
    return
  }
  await fs.mkdir(dir, { recursive: true })
  const cfg = defaultConfig()
  const envName = options?.preferredActiveEnv?.trim()
  const activeEnv
    = envName && envName in cfg.environments ? envName : cfg.activeEnv
  const next: BlagoConfigFile = {
    ...cfg,
    activeEnv,
    environments: environmentsWithOptionalCoopname(cfg.environments, options?.coopname),
  }
  await saveConfig(root, next)
  await ensureBlagoGitignore(root)
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  }
  catch {
    return false
  }
}

export function getActiveProfile(cfg: BlagoConfigFile): BlagoRemoteProfile {
  const profile = cfg.environments[cfg.activeEnv]
  if (!profile) {
    throw new Error(`Среда «${cfg.activeEnv}» не найдена в config.json`)
  }
  if (!profile.api_url?.trim() || !profile.chain_url?.trim()) {
    throw new Error(`У среды «${cfg.activeEnv}» задайте api_url и chain_url (blago env set …)`)
  }
  return profile
}

export {
  buildDefaultGlobalConfig,
  defaultBlagoHomeDataRoot,
  defaultWorkspacePaths,
  ensureGlobalBlagoConfigFile,
  globalBlagoConfigDir,
  globalBlagoConfigPath,
  globalBlagoHelpersPath,
  globalBlagoTemplatesDir,
  mkdirWorkspaceDirs,
  readGlobalBlagoConfig,
  resolveActiveWorkspaceRoot,
  writeGlobalBlagoConfig,
} from './global-config.js'
export type { BlagoAgentHomeRoot } from './install-bundled-agent-homes.js'

export async function initBlagoGlobalLayout(
  options?: {
    coopname?: string
    force?: boolean
    workspaceBase?: string
    /** Пусто или не задано — скиллы и команды из пакета в ~/.claude / ~/.cursor не копируются. */
    agentBundleHomes?: readonly BlagoAgentHomeRoot[]
  },
): Promise<{ global: BlagoGlobalConfigFile }> {
  const global = await ensureGlobalBlagoConfigFile(options?.workspaceBase)
  await copyBundledBlagoAgentHomeBundles(options?.agentBundleHomes ?? [])
  await mkdirWorkspaceDirs(global)
  const names = ['dev', 'testnet', 'production'] as const
  for (const name of names) {
    const wsRoot = global.workspaces[name]
    if (typeof wsRoot === 'string' && wsRoot.trim().length > 0) {
      await initBlagoWorkspace(path.resolve(wsRoot.trim()), {
        coopname: options?.coopname,
        force: options?.force,
        preferredActiveEnv: name,
      })
    }
  }
  return { global }
}
