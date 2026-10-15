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
 *  - branchTrusted   — доверенный кооперативного участка;
 *  - capitalMember   — участник Благороста с договором УХД;
 *  - exited          — вышел из кооператива, выход завершён;
 *  - cashier         — пайщик с назначенной ролью кассира (реестр платежей);
 *  - accountant      — пайщик с назначенной ролью бухгалтера (стол бухгалтера);
 *  - auditor         — пайщик с назначенной ролью ревизора (чтение платежей и стола бухгалтера).
 *
 * Оператор чужого участка и ведущий проекта в матрицу не входят: их право
 * зависит от объекта, а матрица зовёт операции с чужими аргументами. Их
 * проверяют сценарии marketplace/branch-scope и capital/project-roles.
 */
import { completeCapitalRegistration } from '../capital/cap-results.helpers'
import { KRG } from '../marketplace/flow'
import { chooseDeliveryPoint, signOffer } from '../marketplace/onboarding.helpers'
import { approveAsChairman, ensureCapitalChainReady } from '../capital/cap-access.helpers'
import type { Who } from '../core'
import { CHAIRMAN, COOP, completeExit, freshMember, gql, gqlRaw, login, registerCandidate, tokenOf, waitFor } from '../core'

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
      await makeTrusted(who)
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
        return r.errors[0]?.code === 'KIT_INSUFFICIENT_RIGHTS' ? true : null
      }, { timeoutMs: 60_000, intervalMs: 2_000, label: `учётная запись ${who.account} потеряла статус «принят»` })
      return who
    },
  },
  { name: 'cashier', make: () => roleHolder('mxcash', 'cashier') },
  { name: 'accountant', make: () => roleHolder('mxacc', 'accountant') },
  { name: 'auditor', make: () => roleHolder('mxaud', 'auditor') },
]

async function supplierApplicant(prefix: string): Promise<Who> {
  const who = freshMember({ prefix, lastName: 'Поставщиков' })
  await gql(await tokenOf(who), `mutation($i:MarketplaceRequestSupplierInput!){
    marketplaceRequestSupplier(input:$i){ member_account status }
  }`, { i: { contract_number: `МП-${who.account}`, contract_date: '2026-09-01' } })
  return who
}

/**
 * Доверенный участка. Цепь держит на участке не больше трёх доверенных, а
 * сценарии до матрицы занимают места на krg — берётся первый участок, где
 * место есть.
 */
async function makeTrusted(who: Who): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const branches = (await gql<any>(chairman,
    'query($d:GetBranchesInput!){ getBranches(data:$d){ braname trusted_certificates{ username } } }',
    { d: { coopname: COOP } })).getBranches as { braname: string, trusted_certificates: unknown[] | null }[]
  const branch = branches.find(b => (b.trusted_certificates ?? []).length < 3)
  if (!branch)
    throw new Error(`на всех участках по три доверенных: ${branches.map(b => b.braname).join(', ')}`)
  await gql(chairman, 'mutation($d:AddTrustedAccountInput!){ addTrustedAccount(data:$d){ braname } }', {
    d: { coopname: COOP, braname: branch.braname, trusted: who.account },
  })
  // Состав участков Стол заказов держит в кэше на минуту — ждём, пока новый
  // доверенный получит права участка.
  const token = await tokenOf(who)
  await waitFor(async () => {
    const r = await gqlRaw(token, `query($d:MarketplaceAidStatementSignablePayloadInput!){
      marketplaceAidStatementSignablePayload(data:$d){ hash }
    }`, { d: { braname: branch.braname, amount: 1 } })
    // Пока роли оператора нет, гард прав отвечает отказом доступа.
    return r.errors.some(e => String(e.code) === 'KIT_INSUFFICIENT_RIGHTS') ? null : true
  }, { timeoutMs: 150_000, intervalMs: 5_000, label: `доверенный ${who.account} получил права участка ${branch.braname}` })
}

/**
 * Исполнитель «подключённый заказчик» обязан быть подключён к началу прогона:
 * оферта подписана, пункт выдачи выбран. Сценарии до матрицы могли это
 * состояние поменять — тогда столбец пайщика показал бы пайщика без
 * подключения. Возвращает, чего не хватало (пусто — всё было на месте).
 */
export async function ensureOrdererOnboarded(who: Who): Promise<string[]> {
  const token = await tokenOf(who)
  const fixed: string[] = []
  const state = (await gql<any>(token, 'query{ marketplaceOnboardingState{ requires_gate source } }')).marketplaceOnboardingState
  if (state.source !== 'AGREEMENT_SIGNED' || state.requires_gate) {
    await signOffer(who)
    fixed.push(`оферта: было ${state.source}, требуется подпись ${state.requires_gate} — подписана заново`)
  }
  const probe = await gqlRaw(token, 'query{ marketplaceGetCart{ __typename } }')
  if (probe.errors[0]?.code === 'MARKETPLACE_ORDERER_ONBOARDING_REQUIRED') {
    await chooseDeliveryPoint(who, KRG)
    fixed.push('пункт выдачи не был выбран — выбран krg')
  }
  return fixed
}

/** Принятый пайщик, которому председатель назначил роль приложения. */
async function roleHolder(prefix: string, role: string): Promise<Who> {
  const who = await freshMember({ prefix })
  await gql(await tokenOf(CHAIRMAN), 'mutation($d:RoleAssignmentInput!){ assignRole(data:$d){ key } }', { d: { username: who.account, role } })
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
