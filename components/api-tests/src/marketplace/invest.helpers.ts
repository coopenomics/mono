/**
 * Инвестиционный этап кооперативного участка снаружи (задачи 99D-30, 99D-32):
 * договор участия, паевой взнос деньгами и имуществом через API узла, решение
 * совета по имуществу — через цепь, как в остальных наборах с советом.
 */
import { MarketContract } from 'cooptypes'
import { COOP, ROLES, type Who, authorizeDecisionOnChain, decisionByHash, docMeta, gql, signDocument, tableRows, tokenOf, voteOnDecision, waitFor } from '../core'

// Договор об участии заключается на каждый участок (решение владельца 12.11.2026).
export const MY_AGREEMENT = 'query($b:String!){ marketplaceMyInvestAgreement(braname:$b){ number signed_at } }'
export const AGREEMENT_DOC = 'query($b:String!){ marketplaceInvestAgreementSignablePayload(braname:$b){ full_title html hash meta binary } }'
const SIGN_AGREEMENT = 'mutation($d:MarketplaceSignInvestAgreementInput!){ marketplaceSignInvestAgreement(data:$d){ number signed_at } }'
export const INVEST_STATEMENT = 'query($d:MarketplaceInvestStatementInput!){ marketplaceInvestStatementSignablePayload(data:$d){ full_title html hash meta binary } }'
export const INVEST_MONEY = 'mutation($d:MarketplaceInvestMoneyInput!){ marketplaceInvestMoney(data:$d){ phase money_total } }'
export const PROPERTY_STATEMENT = 'query($d:MarketplaceInvestPropertyStatementInput!){ marketplaceInvestPropertyStatementSignablePayload(data:$d){ full_title html hash meta binary } }'
const CREATE_PROPERTY = 'mutation($d:MarketplaceCreateInvestPropertyInput!){ marketplaceCreateInvestProperty(data:$d){ phase } }'
const APPROVAL_DOC = 'query($d:MarketplaceInvestPropertyRefInput!){ marketplaceInvestPropertyApprovalSignablePayload(data:$d){ full_title html hash meta binary } }'
const APPROVE_PROPERTY = 'mutation($d:MarketplaceSignInvestPropertyInput!){ marketplaceApproveInvestProperty(data:$d){ phase } }'
const ACT_DOC = 'query($d:MarketplaceInvestPropertyRefInput!){ marketplaceInvestPropertyActSignablePayload(data:$d){ full_title html hash meta binary } }'
const SIGN_ACT = 'mutation($d:MarketplaceSignInvestPropertyInput!){ marketplaceSignInvestPropertyAct(data:$d){ phase } }'
// Вторую подпись акта ставит председатель совета, подтверждая одобрение, которое
// контракт создал на подписи вносящего (решение владельца 08.11.2026).
const CONFIRM_APPROVE = 'mutation($d:ConfirmApproveInput!){ chairmanConfirmApprove(data:$d){ approval_hash } }'
export const BRANCH_INVESTMENT = `query($b:String!){ marketplaceBranchInvestment(braname:$b){
  braname phase money_total money_in_total property_total unused_total reserved spent_total repaid_total outstanding
  investors{ braname username active settled money money_in property used returned claimed claimable unused }
  properties{ hash username amount status } } }`
export const MY_HISTORY = 'query($o:PaginationInput){ marketplaceMyInvestHistory(options:$o){ items{ kind amount process_hash created_at global_sequence } totalCount } }'
export const MY_INVESTMENTS = 'query{ marketplaceMyInvestments{ braname username active settled money money_in property used returned claimed claimable unused } }'

/** Договор участия пайщика: подписывает, если ещё не подписан. Возвращает номер договора. */
export async function ensureAgreement(who: Who, braname = 'krg'): Promise<string> {
  const token = await tokenOf(who)
  const existing = (await gql<any>(token, MY_AGREEMENT, { b: braname })).marketplaceMyInvestAgreement
  if (existing)
    return existing.number
  const doc = (await gql<any>(token, AGREEMENT_DOC, { b: braname })).marketplaceInvestAgreementSignablePayload
  const agreement = await signDocument(who.wif, doc, who.account, 1)
  const signed = (await gql<any>(token, SIGN_AGREEMENT, { d: { braname, agreement } })).marketplaceSignInvestAgreement
  return signed.number
}

/** Подписанное заявление о паевом взносе деньгами и его идентификатор. */
export async function investStatement(who: Who, braname: string, sum: number): Promise<{ statement: any, investHash: string, meta: Record<string, any> }> {
  const token = await tokenOf(who)
  const doc = (await gql<any>(token, INVEST_STATEMENT, { d: { braname, amount: sum } })).marketplaceInvestStatementSignablePayload
  const meta = docMeta(doc.meta)
  return { statement: await signDocument(who.wif, doc, who.account, 1), investHash: String(meta.invest_hash), meta }
}

/** Паевой взнос деньгами в участок по подписанному заявлению. */
export async function investMoney(who: Who, braname: string, sum: number): Promise<any> {
  const { statement, investHash } = await investStatement(who, braname, sum)
  const view = (await gql<any>(await tokenOf(who), INVEST_MONEY, { d: { braname, amount: sum, invest_hash: investHash, statement } })).marketplaceInvestMoney
  return { ...view, investHash }
}

/** Строка заявления на имущество в цепи по идентификатору. */
async function propertyRow(propertyHash: string): Promise<any | undefined> {
  const rows = await tableRows<any>('marketplace', COOP, 'invprops')
  return rows.find(r => String(r.hash).toLowerCase() === propertyHash.toLowerCase())
}

/**
 * Имущество принято в участок целиком: заявление вносящего, одобрение
 * председателем участка, решение совета (робот либо голоса членов совета и
 * утверждение председателем), акт двумя подписями. Вносящий — оператор
 * участка, председатель участка подписывает одобрение и вторую подпись акта.
 */
export async function investPropertyAccepted(opts: { investor: Who, chairman: Who, braname: string, sum: number, name: string }): Promise<string> {
  const { investor, chairman, braname, sum, name } = opts
  const investorToken = await tokenOf(investor)
  const chairmanToken = await tokenOf(chairman)
  const fields = { braname, property_name: name, property_description: 'Исправно, проверено при приёме', property_quantity: '1', property_unit: 'шт.', amount: sum }

  const statementDoc = (await gql<any>(investorToken, PROPERTY_STATEMENT, { d: fields })).marketplaceInvestPropertyStatementSignablePayload
  const propertyHash = String(docMeta(statementDoc.meta).property_hash)
  const statement = await signDocument(investor.wif, statementDoc, investor.account, 1)
  await gql(investorToken, CREATE_PROPERTY, { d: { ...fields, property_hash: propertyHash, statement } })

  const approvalDoc = (await gql<any>(chairmanToken, APPROVAL_DOC, { d: { braname, property_hash: propertyHash } })).marketplaceInvestPropertyApprovalSignablePayload
  const approval = await signDocument(chairman.wif, approvalDoc, chairman.account, 1)
  await gql(chairmanToken, APPROVE_PROPERTY, { d: { braname, property_hash: propertyHash, document: approval } })

  // Робот совета принимает решение сам и стирает строку решения после
  // исполнения — тогда заявление уже «authorized». Без робота решение ждёт в
  // повестке: голоса членов совета и утверждение председателем в цепи.
  const authorized = async () => String((await propertyRow(propertyHash))?.status ?? '') === 'authorized'
  const decision = await waitFor(
    async () => ((await authorized()) ? { robot: true } : ((await decisionByHash(propertyHash)) ?? null)),
    { timeoutMs: 60_000, intervalMs: 1_000, label: `повестка совета по имуществу ${name}` },
  )
  if (!('robot' in decision) && !(await authorized())) {
    await voteOnDecision(Number(decision.id))
    await authorizeDecisionOnChain(Number(decision.id))
  }
  await waitFor(async () => ((await authorized()) ? true : null), { timeoutMs: 60_000, intervalMs: 1_000, label: `решение совета о приёме ${name}` })

  // Акт один на обе подписи: вносящий подписывает первым, контракт создаёт
  // одобрение, председатель совета подписывает тот же документ второй подписью.
  const actDoc = (await gql<any>(investorToken, ACT_DOC, { d: { braname, property_hash: propertyHash } })).marketplaceInvestPropertyActSignablePayload
  const act1 = await signDocument(investor.wif, actDoc, investor.account, 1)
  await gql(investorToken, SIGN_ACT, { d: { braname, property_hash: propertyHash, document: act1 } })
  const coopChairman = ROLES.chairman()
  const act2 = await signDocument(coopChairman.wif, actDoc, coopChairman.account, 2, [act1])
  await gql(await tokenOf(coopChairman), CONFIRM_APPROVE, { d: { coopname: COOP, approval_hash: propertyHash.toLowerCase(), approved_document: act2 } })
  return propertyHash
}

/** Строки участка и инициатора в цепи — для сверки предпросмотра с формулой контракта. */
export async function chainInvestment(braname: string, username: string): Promise<{ branch: any, investor: any }> {
  const [branches, investors] = await Promise.all([
    tableRows<any>('marketplace', COOP, 'invbranches'),
    tableRows<any>('marketplace', COOP, 'investors'),
  ])
  return {
    branch: branches.find(b => b.braname === braname),
    investor: investors.find(i => i.braname === braname && i.username === username),
  }
}

const unitsOf = (asset: unknown): bigint => {
  const [int = '0', frac = ''] = String(asset ?? '0').trim().split(/\s+/)[0]!.split('.')
  return BigInt(int) * 10_000n + BigInt((frac + '0000').slice(0, 4))
}

/** Доступное к трансляции по формуле контракта (`PeriodModel.crpsClaimable`) на строках цепи. */
export function contractClaimable(branch: any, investor: any): bigint {
  const { crpsClaimable } = MarketContract.PeriodModel
  return crpsClaimable(
    {
      base: BigInt(branch.base ?? 0),
      acc: BigInt(branch.acc ?? 0),
      sJoin: BigInt(branch.s_join ?? 0),
      sFixed: BigInt(branch.s_fixed ?? 0),
      unusedTotal: unitsOf(branch.unused_total),
      reserved: unitsOf(branch.reserved),
    },
    {
      active: investor.status === 'active',
      money: unitsOf(investor.money),
      property: unitsOf(investor.property),
      usedMoney: unitsOf(investor.used_money),
      claimed: unitsOf(investor.claimed),
      returnedFixed: BigInt(investor.returned_fixed ?? 0),
      accJoin: BigInt(investor.acc_join ?? 0),
    },
  ).total
}

export { unitsOf }
