/**
 * Свежий пайщик под тест. Общих участников (ant, фикстуры) тесты не портят:
 * их состояние видят все следующие файлы прогона, а порядок файлов — не
 * контракт. Кто меняет состояние пайщика (подписи, кошельки, выход), берёт
 * своего.
 *
 * Создаёт его тот же скрипт стенда, что и фикстуры docs-harness
 * (boot add-plain-participant): регистрация в цепи с ключом, соглашение
 * «Кошелёк», карточка и строка пользователя. Это подготовка стенда, а не
 * проверяемое поведение, поэтому она идёт мимо API — как сид.
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import type { Who } from './auth'
import { ApiError, gqlRaw } from './client'
import { CHAIN_URL, REPO_ROOT } from './env'

/** Имя аккаунта: 12 символов из a-z1-5, начинается с префикса теста. */
export function randomAccount(prefix = 'at'): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz12345'
  const bytes = crypto.randomBytes(12)
  let s = prefix.toLowerCase().replace(/[^a-z1-5]/g, '').slice(0, 4)
  for (let i = 0; s.length < 12; i++)
    s += alphabet[bytes[i] % alphabet.length]
  return s
}

export interface FreshMemberOptions {
  /** Префикс имени — по нему видно в логах стенда, какой тест завёл пайщика. */
  prefix?: string
  firstName?: string
  lastName?: string
  middleName?: string
}

/** Новый пайщик кооператива (role=user) с собственным ключом. */
export function freshMember(opts: FreshMemberOptions = {}): Who {
  const account = randomAccount(opts.prefix)
  const email = `${account}@api-tests.coop`
  const r = spawnSync(
    'pnpm',
    [
      '--filter', '@coopenomics/boot', 'exec', 'esno', 'src/scripts/add-plain-participant.ts',
      account, email, opts.firstName ?? 'Тест', opts.lastName ?? 'Внешнийслой', opts.middleName ?? 'Проверочный',
    ],
    { cwd: REPO_ROOT, env: { ...process.env, CHAIN_URL }, encoding: 'utf8' },
  )
  if (r.status !== 0)
    throw new Error(`add-plain-participant ${account} упал:\n${(r.stderr || r.stdout).slice(-2000)}`)
  const last = (r.stdout || '').split('\n').filter(l => l.trim()).pop() ?? ''
  const j = JSON.parse(last)
  if (!j.wif)
    throw new Error(`add-plain-participant ${account} не вернул ключ`)
  return { account, email, wif: j.wif }
}

export interface Candidate {
  username: string
  email: string
  token: string
  subscriberId: string
  isEmailVerified: boolean
}

const REGISTER = `mutation($d:RegisterAccountInput!){ registerAccount(data:$d){
  tokens{ access{ token } } account{ username provider_account{ email subscriber_id is_email_verified } } } }`

/**
 * Кандидат открытой регистрации — как с формы вступления: учётная запись и
 * токен есть, советом пайщик ещё не принят. `ip` — адрес клиента для лимитов
 * по IP (X-Forwarded-For).
 */
export async function registerCandidate(opts: { prefix?: string, email?: string, ip?: string } = {}): Promise<Candidate> {
  const username = randomAccount(opts.prefix ?? 'cand')
  const wif = await ecc.randomKey()
  const r = await gqlRaw<any>(null, REGISTER, {
    d: {
      email: opts.email ?? `${username}@api-tests.coop`,
      type: 'individual',
      username,
      public_key: ecc.privateToPublic(wif),
      individual_data: {
        first_name: 'Тест',
        last_name: 'Кандидатов',
        middle_name: 'Проверочный',
        birthdate: '1990-01-01',
        phone: '+70000000000',
        full_address: 'г. Москва, ул. Тестовая, 1',
      },
    },
  }, opts.ip ? { 'X-Forwarded-For': opts.ip } : {})
  if (r.errors.length)
    throw new ApiError(r.errors, r.status)
  const pa = r.data.registerAccount.account.provider_account
  return {
    username,
    email: pa.email,
    token: r.data.registerAccount.tokens.access.token,
    subscriberId: pa.subscriber_id,
    isEmailVerified: pa.is_email_verified,
  }
}
