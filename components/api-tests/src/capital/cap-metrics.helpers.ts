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
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { tableRows, transact } from '../core/chain'
import { gql } from '../core/client'
import { API_URL, COOP } from '../core/env'
import { registerCandidate } from '../core/participants'
import { COOP_SIGNER, deposit, rub } from '../core/wallet'
import { randomHash } from '../core/chain'
import { ZERO_HASH, chainDoc, completeCapitalRegistration } from './cap-results.helpers'



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


/**
 * Регистрация участника Благороста в цепи: договор УХД, соглашение о хранении
 * и соглашение программы, подписанные ключом пайщика. Договор уходит на
 * одобрение председателю — до него участник в цепи не активен.
 */
export async function registerContributorInChain(who: Who): Promise<string> {
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
      storage_agreement: chainDoc([who]),
      contract: chainDoc([who]),
      blagorost_agreement: chainDoc([who]),
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
  await completeCapitalRegistration(who, 'Участник внешнего теста')
  const token = await tokenOf(who)
  const c = await gql<any>(token, 'query($d:GetContributorInput!){ capitalContributor(data:$d){ contributor_hash } }', { d: { username: who.account } })
  return String(c.capitalContributor.contributor_hash).toLowerCase()
}


/**
 * Свободные средства программы: пайщик регистрируется участником Благороста
 * (договор УХД + соглашение программы) и вносит программную инвестицию —
 * сумма уходит в глобальный пул программы. Подготовка через цепь, как сид.
 */
export async function fundProgramPool(investor: Who, amountRub: number): Promise<void> {
  await deposit(investor.account, amountRub + 1_000)
  await registerContributorInChain(investor)
  await transact(COOP_SIGNER, [{
    account: 'capital',
    name: 'createpinv',
    data: {
      coopname: COOP,
      username: investor.account,
      invest_hash: randomHash(),
      amount: rub(amountRub),
      statement: chainDoc([investor]),
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
  const c = await registerCandidate({ prefix: 'apl' })
  return { username: c.username, token: c.token }
}

export { randomHash }

export { ZERO_HASH }
