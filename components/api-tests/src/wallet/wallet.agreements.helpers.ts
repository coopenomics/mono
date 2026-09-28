/**
 * Помощники соглашений пайщика: генерация документа соглашения, подпись
 * ключом пайщика, подача и чтение. Только действия и чтение через API.
 */
import type { Who } from '../core'
import { COOP, gql, signDocument } from '../core'

export const GENERATED_FIELDS = 'full_title html hash meta binary'

/** Мутации генерации по типу соглашения кооператива (soviet::coagreements). */
const GENERATOR_BY_TYPE: Record<string, string> = {
  wallet: 'generateWalletAgreement',
  signature: 'generateSignatureAgreement',
  privacy: 'generatePrivacyAgreement',
  user: 'generateUserAgreement',
}

export async function generateAgreement(token: string, who: Who, type: string): Promise<any> {
  const op = GENERATOR_BY_TYPE[type]
  if (!op)
    throw new Error(`генератор соглашения ${type} тесту неизвестен`)
  const d = await gql<any>(token, `mutation($d:GenerateDocumentInput!){ ${op}(data:$d){ ${GENERATED_FIELDS} } }`, {
    d: { coopname: COOP, username: who.account },
  })
  return d[op]
}

export const SEND_AGREEMENT = 'mutation($d:SendAgreementInput!){ sendAgreement(data:$d){ __typename } }'
export const CONFIRM_AGREEMENT = 'mutation($d:ConfirmAgreementInput!){ confirmAgreement(data:$d){ __typename } }'
export const DECLINE_AGREEMENT = 'mutation($d:DeclineAgreementInput!){ declineAgreement(data:$d){ __typename } }'

export function sendInput(username: string, type: string, document: unknown): Record<string, unknown> {
  return { d: { coopname: COOP, administrator: COOP, username, agreement_type: type, document } }
}

/** Подписать сгенерированное соглашение (подписант — `signerAccount`, ключ — `wif`) и подать от имени `username`. */
export async function signAndSend(token: string, args: { username: string, type: string, doc: any, wif: string, signerAccount?: string }): Promise<void> {
  const signed = await signDocument(args.wif, args.doc, args.signerAccount ?? args.username, 1)
  await gql(token, SEND_AGREEMENT, sendInput(args.username, args.type, signed))
}

export const AGREEMENT_FIELDS = 'id username type program_id draft_id version status updated_at document{ hash }'
export const AGREEMENTS = `query($f:AgreementFilter,$o:PaginationInput){ agreements(filter:$f, options:$o){ totalCount items{ ${AGREEMENT_FIELDS} } } }`

export async function agreementsOf(token: string, filter: Record<string, unknown>): Promise<any[]> {
  const d = await gql<any>(token, AGREEMENTS, { f: { coopname: COOP, ...filter }, o: { page: 1, limit: 100, sortOrder: 'DESC' } })
  return d.agreements.items
}
