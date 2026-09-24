/**
 * Благорост для внешних тестов мер, редакций и денежных мест программы.
 * Здесь только подготовка и чтение — ассертов нет: проверки живут в тестах.
 *
 * Персональный (local) проект живёт только в базе контроллера — на нём меры,
 * цели и редакции проверяются без цепи. Кооперативный проект заводится через
 * API председателем и уходит в цепь; для него контракт capital должен быть
 * инициализирован (state), а для денежных мест — иметь свободные средства
 * программы. Их готовит цепь напрямую, как сид: регистрация участника
 * Благороста и программная инвестиция ключом кооператива.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import { gql } from '../core/client'
import { signDocument } from '../core/documents'
import { API_URL, COOP } from '../core/env'
import { randomAccount } from '../core/participants'
import { CHAIRMAN } from '../core/roles'
import { COOP_SIGNER, deposit, rub } from '../core/wallet'

export const ZERO_HASH = '0'.repeat(64)

export function randomHash(): string {
  return crypto.randomBytes(32).toString('hex')
}

/** Хеш текста так, как его кладёт в цепь контроллер (extension-kit chainTextDigest). */
export function textDigest(text: string): string {
  return text ? crypto.createHash('sha256').update(text, 'utf8').digest('hex') : ''
}

/** Метка прогона — чтобы свои меры и проекты не пересекались с чужими на общем стенде. */
export function runTag(): string {
  return crypto.randomBytes(4).toString('hex')
}

// ── Ошибка GraphQL целиком (с extensions) ───────────────────────────────────

export interface FullGqlError {
  message: string
  code: string | null
  extensions: Record<string, any>
}

/**
 * Первая ошибка вызова вместе с extensions. Каркасный gqlError отдаёт только
 * код, а конфликт редакций несёт в extensions.conflict обе версии текста.
 */
export async function gqlErrorFull(token: string | null, query: string, variables?: unknown): Promise<FullGqlError | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token)
    headers.Authorization = `Bearer ${token}`
  const res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  const payload: any = await res.json()
  const e = payload?.errors?.[0]
  if (!e)
    return null
  return { message: String(e.message ?? ''), code: e.extensions?.code ?? null, extensions: e.extensions ?? {} }
}

// ── Проекты ─────────────────────────────────────────────────────────────────

const PROJECT_FIELDS = 'project_hash title description invite content_rev status origin present fact{ program_invest_pool invest_pool total_received_investments }'

export async function getProject(token: string, hash: string): Promise<any | null> {
  const d = await gql<any>(token, `query($d:GetProjectInput!){ capitalProject(data:$d){ ${PROJECT_FIELDS} } }`, { d: { hash } })
  return d.capitalProject
}

/** Персональный проект (только база контроллера) — владелец тот, чей токен. */
export async function createLocalProject(token: string, opts: { title: string, description: string, parent_hash?: string }): Promise<string> {
  const hash = randomHash()
  await gql(token, 'mutation($d:CreateProjectInput!){ capitalCreateLocalProject(data:$d){ project_hash } }', {
    d: {
      coopname: COOP,
      project_hash: hash,
      parent_hash: opts.parent_hash ?? ZERO_HASH,
      title: opts.title,
      description: opts.description,
      invite: '',
      meta: '',
      data: '',
    },
  })
  return hash
}

/** Кооперативный проект (или компонент при parent_hash) — заводит председатель, запись уходит в цепь. */
export async function createChainProject(opts: { title: string, description: string, invite?: string, parent_hash?: string }): Promise<string> {
  const hash = randomHash()
  await gql(await tokenOf(CHAIRMAN), 'mutation($d:CreateProjectInput!){ capitalCreateProject(data:$d){ __typename } }', {
    d: {
      coopname: COOP,
      project_hash: hash,
      parent_hash: opts.parent_hash ?? ZERO_HASH,
      title: opts.title,
      description: opts.description,
      invite: opts.invite ?? '',
      meta: '',
      data: '',
    },
  })
  return hash
}

export const EDIT_PROJECT = 'mutation($d:EditProjectInput!){ capitalEditProject(data:$d){ __typename } }'

export function editProjectInput(hash: string, p: { title: string, description: string, invite?: string, base_rev?: number }) {
  return {
    d: {
      coopname: COOP,
      project_hash: hash,
      title: p.title,
      description: p.description,
      invite: p.invite ?? '',
      meta: '',
      data: '',
      ...(p.base_rev !== undefined ? { base_rev: p.base_rev } : {}),
    },
  }
}

// ── Редакции ────────────────────────────────────────────────────────────────

export async function listRevisions(token: string, entityType: 'PROJECT' | 'STORY' | 'ISSUE', hash: string): Promise<any[]> {
  const d = await gql<any>(token,
    'query($d:CapitalGetContentRevisionsInput!){ capitalGetContentRevisions(data:$d){ rev base_rev origin author merged title description_length } }',
    { d: { entity_type: entityType, entity_hash: hash } })
  return d.capitalGetContentRevisions
}

export async function getRevision(token: string, entityType: 'PROJECT' | 'STORY' | 'ISSUE', hash: string, rev: number): Promise<any | null> {
  const d = await gql<any>(token,
    'query($d:CapitalGetContentRevisionInput!){ capitalGetContentRevision(data:$d){ rev title description origin merged } }',
    { d: { entity_type: entityType, entity_hash: hash, rev } })
  return d.capitalGetContentRevision
}

// ── Цепь: контракт capital и средства программы ─────────────────────────────

/**
 * Контракт capital инициализирован для кооператива. На полном стенде это
 * делает набор boot, на быстром полигоне — никто; параметры те же, что у
 * seed-capital (фаза 01). Повторно не трогает уже заведённый конфиг.
 */
export async function ensureCapitalInitialized(): Promise<void> {
  const rows = await tableRows<any>('capital', 'capital', 'state')
  if (rows.some(r => r.coopname === COOP))
    return
  await transact(COOP_SIGNER, [{
    account: 'capital',
    name: 'setconfig',
    data: {
      coopname: COOP,
      config: {
        coordinator_bonus_percent: 4,
        expense_pool_percent: 100,
        coordinator_invite_validity_days: 30,
        voting_period_in_days: 7,
        authors_voting_percent: 38.2,
        creators_voting_percent: 38.2,
        energy_decay_rate_per_day: 0.11,
        level_depth_base: 1000,
        level_growth_coefficient: 1.5,
        energy_gain_coefficient: 0.01,
      },
    },
  }])
}

/** Документ, подписанный ключом пайщика (цепь сверяет ключ с аккаунтом подписанта). */
export function signedDoc(who: Who, hash = randomHash()) {
  return {
    version: '1.0.0',
    hash,
    doc_hash: hash,
    meta_hash: hash,
    meta: '{}',
    signatures: [{
      id: 1,
      signed_hash: hash,
      signer: who.account,
      public_key: ecc.privateToPublic(who.wif),
      signature: ecc.signHash(hash, who.wif),
      signed_at: '2026-09-24T00:00:00',
      meta: '{}',
    }],
  }
}

/**
 * Регистрация участника Благороста в цепи: договор УХД, соглашение о хранении
 * и соглашение программы, подписанные ключом пайщика. Договор уходит на
 * одобрение председателю — до него участник в цепи не активен.
 */
export async function registerContributor(who: Who): Promise<string> {
  const contributorHash = randomHash()
  await transact(COOP_SIGNER, [{
    account: 'capital',
    name: 'regcontrib',
    data: {
      coopname: COOP,
      username: who.account,
      contributor_hash: contributorHash,
      rate_per_hour: rub(0),
      hours_per_day: 0,
      is_external_contract: false,
      storage_agreement: signedDoc(who),
      contract: signedDoc(who),
      blagorost_agreement: signedDoc(who),
      generator_agreement: null,
    },
  }])
  return contributorHash
}

/**
 * Регистрация участника Благороста тем путём, что и рабочий стол: контроллер
 * собирает пакет документов, пайщик подписывает их своим ключом, контроллер
 * заводит карточку участника и отправляет договор в цепь. Возвращает хеш
 * участника — по нему председатель одобряет договор.
 */
export async function registerContributorViaApi(who: Who): Promise<string> {
  const token = await tokenOf(who)
  const g = await gql<any>(token, `mutation($d:GenerateCapitalRegistrationDocumentsInputDTO!){ capitalGenerateRegistrationDocuments(data:$d){
    generation_contract{ full_title html hash meta binary }
    storage_agreement{ full_title html hash meta binary }
    blagorost_agreement{ full_title html hash meta binary }
    generator_offer{ full_title html hash meta binary }
  } }`, { d: { coopname: COOP, username: who.account, lang: 'ru' } })
  const bundle = g.capitalGenerateRegistrationDocuments
  const signed: Record<string, unknown> = {}
  let sigId = 1
  for (const key of ['generation_contract', 'storage_agreement', 'blagorost_agreement', 'generator_offer'] as const) {
    if (bundle[key])
      signed[key] = await signDocument(who.wif, bundle[key], who.account, sigId++)
  }
  await gql(token, 'mutation($d:CompleteCapitalRegistrationInputDTO!){ capitalCompleteRegistration(data:$d){ __typename } }', {
    d: { coopname: COOP, username: who.account, ...signed, about: 'Участник внешнего теста', rate_per_hour: '0', hours_per_day: 0 },
  })
  const c = await gql<any>(token, 'query($d:GetContributorInput!){ capitalContributor(data:$d){ contributor_hash } }', { d: { username: who.account } })
  return String(c.capitalContributor.contributor_hash).toLowerCase()
}

/** Одобрение договора УХД председателем — участник становится активным в цепи. */
export async function approveContributor(contributorHash: string): Promise<void> {
  await transact(COOP_SIGNER, [{
    account: 'soviet',
    name: 'confirmapprv',
    data: { coopname: COOP, username: CHAIRMAN.account, approval_hash: contributorHash, approved_document: signedDoc(CHAIRMAN) },
  }])
}

/**
 * Свободные средства программы: пайщик регистрируется участником Благороста
 * (договор УХД + соглашение программы) и вносит программную инвестицию —
 * сумма уходит в глобальный пул программы. Подготовка через цепь, как сид.
 */
export async function fundProgramPool(investor: Who, amountRub: number): Promise<void> {
  await deposit(investor.account, amountRub + 1_000)
  await registerContributor(investor)
  await transact(COOP_SIGNER, [{
    account: 'capital',
    name: 'createpinv',
    data: {
      coopname: COOP,
      username: investor.account,
      invest_hash: randomHash(),
      amount: rub(amountRub),
      statement: signedDoc(investor),
    },
  }])
}

/** Свободный остаток программы в цепи (для предусловий, не для проверок). */
export async function chainFreePool(): Promise<number> {
  const rows = await tableRows<any>('capital', 'capital', 'state')
  const st = rows.find(r => r.coopname === COOP)
  return Number.parseFloat(String(st?.global_available_invest_pool ?? '0').split(' ')[0])
}

// ── Учётная запись без приёма в пайщики ─────────────────────────────────────

/**
 * Регистрация на платформе без решения совета: учётная запись есть, токен
 * выдан, а пайщиком человек ещё не принят (статус вступления).
 */
export async function registerApplicant(): Promise<{ username: string, token: string }> {
  const username = randomAccount('apl')
  const wif: string = await ecc.randomKey()
  const d = await gql<any>(null,
    'mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ account{ username } tokens{ access{ token } } } }',
    {
      d: {
        email: `${username}@api-tests.coop`,
        username,
        public_key: ecc.privateToPublic(wif),
        type: 'individual',
        individual_data: {
          first_name: 'Заявитель',
          last_name: 'Внешнийслой',
          middle_name: 'Проверочный',
          birthdate: '1990-01-01',
          full_address: 'г. Москва, ул. Тестовая, д. 1',
          phone: '+79000000000',
        },
      },
    })
  return { username: d.registerAccount.account.username, token: d.registerAccount.tokens.access.token }
}
