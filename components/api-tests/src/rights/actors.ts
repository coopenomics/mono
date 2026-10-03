/**
 * Исполнители по состояниям для матрицы прав (C28-87).
 *
 * Роль кооператива у всех одна — пайщик, а права разные: их меняет состояние
 * человека. Каждый исполнитель заводится здесь тем же путём, каким состояние
 * возникает в жизни, и получает свой столбец в матрице и снимке:
 *
 *  - candidate       — зарегистрировался, советом ещё не принят;
 *  - newcomer        — принят, к Столу заказов не подключался;
 *  - supplierPending — подал заявку поставщика, решения нет;
 *  - supplierRejected — заявку поставщика отклонил председатель;
 *  - branchTrusted   — доверенный участка krg;
 *  - capitalMember   — участник Благороста с договором УХД;
 *  - exited          — вышел из кооператива, выход завершён.
 *
 * Оператор чужого участка и ведущий проекта в матрицу не входят: их право
 * зависит от объекта, а матрица зовёт операции с чужими аргументами. Их
 * проверяют сценарии marketplace/branch-scope и capital/project-roles.
 */
import { completeCapitalRegistration } from '../capital/cap-results.helpers'
import { approveAsChairman, ensureCapitalChainReady } from '../capital/cap-access.helpers'
import type { Who } from '../core'
import { CHAIRMAN, COOP, completeExit, freshMember, gql, gqlRaw, login, registerCandidate, tokenOf, waitFor } from '../core'
import { makeBranchTrusted } from '../documents/docs-reports.helpers'

export interface StateActor {
  name: string
  who: Who
}

const MAKERS: { name: string, make: () => Promise<Who> }[] = [
  {
    name: 'candidate',
    make: async () => {
      const c = await registerCandidate({ prefix: 'mxcand' })
      return { account: c.username, email: c.email, wif: c.wif }
    },
  },
  { name: 'newcomer', make: async () => freshMember({ prefix: 'mxnew' }) },
  { name: 'supplierPending', make: () => supplierApplicant('mxsp') },
  {
    name: 'supplierRejected',
    make: async () => {
      const who = await supplierApplicant('mxsr')
      await gql(await tokenOf(CHAIRMAN), `mutation($i:MarketplaceSupplierMemberInput!){
        marketplaceRejectSupplier(input:$i){ member_account status }
      }`, { i: { member_account: who.account } })
      return who
    },
  },
  {
    name: 'branchTrusted',
    make: async () => {
      const who = freshMember({ prefix: 'mxtr' })
      await makeBranchTrusted(who)
      return who
    },
  },
  {
    name: 'capitalMember',
    make: async () => {
      await ensureCapitalChainReady()
      const who = freshMember({ prefix: 'mxcap' })
      await completeCapitalRegistration(who, 'Участник Благороста для матрицы прав')
      const c = await gql<any>(await tokenOf(CHAIRMAN),
        'query($d:GetContributorInput!){ capitalContributor(data:$d){ contributor_hash } }',
        { d: { username: who.account } })
      await approveAsChairman(String(c.capitalContributor.contributor_hash).toLowerCase())
      return who
    },
  },
  {
    name: 'exited',
    make: async () => {
      const who = freshMember({ prefix: 'mxexit' })
      const token = await login(who)
      await completeExit(who)
      // Статус «принят» снимает слушатель события цепи — после разбора блока.
      await waitFor(async () => {
        const r = await gqlRaw(token, 'query($d:GetMeetsInput!){ getMeets(data:$d){ hash } }', { d: { coopname: COOP } })
        return r.errors[0]?.code === 'KIT_MEMBERS_ONLY' ? true : null
      }, { timeoutMs: 60_000, intervalMs: 2_000, label: `учётная запись ${who.account} потеряла статус «принят»` })
      return who
    },
  },
]

async function supplierApplicant(prefix: string): Promise<Who> {
  const who = freshMember({ prefix, lastName: 'Поставщиков' })
  await gql(await tokenOf(who), `mutation($i:MarketplaceRequestSupplierInput!){
    marketplaceRequestSupplier(input:$i){ member_account status }
  }`, { i: { contract_number: `МП-${who.account}`, contract_date: '2026-09-01' } })
  return who
}

/**
 * Завести исполнителей. Сбой одного не роняет остальных: матрица снимается с
 * теми, кто получился, а про несозданных говорит отдельная проверка.
 */
export async function stateActors(): Promise<{ ready: StateActor[], missing: string[] }> {
  const ready: StateActor[] = []
  const missing: string[] = []
  for (const m of MAKERS) {
    try {
      ready.push({ name: m.name, who: await m.make() })
    }
    catch (e: any) {
      missing.push(`${m.name}: ${String(e?.message ?? e).slice(0, 300)}`)
    }
  }
  return { ready, missing }
}
