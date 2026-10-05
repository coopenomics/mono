/**
 * Документы выхода пайщика из кооператива — как их собирает рабочий стол:
 * заявление на выход и, когда у пайщика есть программные соглашения,
 * заявление об аннулировании соглашений об участии в программах. Оба несут
 * общий хэш выхода; во втором названо, что вернётся по каждой программе.
 */
import type { Who } from '../core'
import { COOP, docMeta, gql, signDocument, waitFor } from '../core'

const GENERATE_APPLICATION = `mutation($d:MembershipExitApplicationGenerateDocumentInput!){
  generateMembershipExitApplication(data:$d){ full_title html hash meta binary }
}`
const GENERATE_ANNULMENT = `mutation($d:ProgramAgreementsAnnulmentGenerateDocumentInput!,$o:GenerateDocumentOptionsInput){
  generateProgramAgreementsAnnulment(data:$d, options:$o){ full_title html hash meta binary }
}`
export const EXIT_RETURN_PREVIEW = `query($c:String!,$u:String!){ membershipExitReturnPreview(coopname:$c, username:$u){
  total share_contribution minimum_contribution blockers
  programs{ program_id title agreement_signed_at agreement_hash refund wallets{ wallet_name human_name balance returns policy } }
} }`

/** Поля мета заявления на выход, которые принимает вход подачи (MembershipExitApplicationSignedMetaDocumentInput). */
const STATEMENT_META_KEYS = ['block_num', 'coopname', 'created_at', 'generator', 'lang', 'links', 'registry_id', 'skip_save', 'timezone', 'title', 'username', 'version']
/** Поля мета заявления об аннулировании соглашений (ProgramAgreementsAnnulmentSignedMetaDocumentInput). */
const ANNULMENT_META_KEYS = [...STATEMENT_META_KEYS, 'exit_hash', 'programs', 'total_refund']

function withMeta(signed: any, keys: string[]): any {
  const meta = docMeta(signed.meta)
  return { ...signed, meta: Object.fromEntries(keys.filter(k => k in meta).map(k => [k, meta[k]])) }
}

export async function exitReturnPreview(token: string, username: string): Promise<any> {
  return (await gql<any>(token, EXIT_RETURN_PREVIEW, { c: COOP, u: username })).membershipExitReturnPreview
}

export interface ExitDocuments {
  statement: any
  /** Нет, когда у пайщика нет программных соглашений — аннулировать нечего. */
  annulment?: any
}

/** Программы пайщика с подписанным соглашением — то, что аннулирует выход. */
function signedPrograms(preview: any): any[] {
  return (preview.programs as any[])
    .filter(p => Boolean(p.agreement_hash) && p.program_id > 0)
    .map(p => ({
      program_id: p.program_id,
      title: p.title,
      agreement_signed_at: p.agreement_signed_at ?? '',
      agreement_hash: p.agreement_hash ?? '',
      refund: p.refund,
      wallets: (p.wallets as any[]).map(w => ({ wallet_name: w.wallet_name, human_name: w.human_name, balance: w.balance, returns: w.returns })),
    }))
}

/**
 * Подписанные пайщиком документы выхода под хэшем `exitHash`.
 *
 * `withPrograms` — у пайщика заведомо есть программные соглашения (свежий
 * пайщик стенда подписывает соглашение «Кошелёк»): помощник дожидается, пока
 * узел их покажет, чтобы заявление об аннулировании не пропало из-за того, что
 * подпись соглашения ушла в цепь мимо контроллера и зеркало её ещё не разобрало.
 */
export async function exitDocuments(who: Who, token: string, exitHash: string, opts: { withPrograms?: boolean } = {}): Promise<ExitDocuments> {
  const g = await gql<any>(token, GENERATE_APPLICATION, { d: { coopname: COOP, username: who.account, skip_save: false } })
  const statement = withMeta(await signDocument(who.wif, g.generateMembershipExitApplication, who.account, 1), STATEMENT_META_KEYS)

  const preview = opts.withPrograms
    ? await waitFor(async () => {
      const p = await exitReturnPreview(token, who.account)
      return signedPrograms(p).length ? p : null
    }, { timeoutMs: 60_000, intervalMs: 1_000, label: `программные соглашения ${who.account} видны узлу` })
    : await exitReturnPreview(token, who.account)
  const programs = signedPrograms(preview)
  if (!programs.length)
    return { statement }

  const a = await gql<any>(token, GENERATE_ANNULMENT, {
    d: { coopname: COOP, username: who.account, skip_save: false, exit_hash: exitHash, programs, total_refund: preview.total },
    o: { lang: 'ru' },
  })
  const annulment = withMeta(await signDocument(who.wif, a.generateProgramAgreementsAnnulment, who.account, 1), ANNULMENT_META_KEYS)
  return { statement, annulment }
}
