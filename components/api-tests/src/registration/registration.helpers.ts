/**
 * Вступление в кооператив глазами заявителя: учётная запись гостя и заявление
 * целиком — так, как его подаёт рабочий стол. Используют наборы анкет
 * вступления (intake-forms.test.ts) и замер памяти вступления
 * (ram-cost/registration.test.ts). Программа и анкеты необязательны: без них
 * заявитель вступает с базовыми документами кооператива.
 */
import { COOP, gql, gqlRaw, randomAccount, signDocument } from '../core'
import { freshKeyPair, individualData, registerInput } from '../platform/platform-b.helpers'

export const REGISTER_PARTICIPANT = `mutation($d:RegisterParticipantInput!){ registerParticipant(data:$d){ username } }`

export interface Applicant { username: string, token: string, publicKey: string, wif: string }

/** Гость заводит аккаунт — дальше он подаёт заявление своим токеном. */
export async function applicant(prefix = 'in'): Promise<Applicant> {
  const username = randomAccount(prefix)
  const { publicKey, wif } = await freshKeyPair()
  const d = await gql<any>(null, `mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ tokens{ access{ token } } } }`, {
    d: registerInput(username, publicKey, 'individual', individualData()),
  })
  return { username, publicKey, wif, token: d.registerAccount.tokens.access.token }
}

/** Собственноручная подпись заявления — картинка 1×1, как её присылает рабочий стол. */
export const HAND_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * Заявление целиком, как его подаёт рабочий стол: документы вступления
 * программы, подписанные ключом заявителя, и заявление со ссылками на них.
 */
export async function fullApplication(a: Applicant, programKey?: string, intakeAnswers?: unknown[]) {
  const gen = await gql<any>(a.token, `mutation($d:GenerateRegistrationDocumentsInput!){
    generateRegistrationDocuments(data:$d){ documents{ id link_to_statement document{ full_title html hash meta binary } } }
  }`, { d: { coopname: COOP, username: a.username, account_type: 'individual', program_key: programKey } })
  const signed: Record<string, any> = {}
  const links: string[] = []
  for (const doc of gen.generateRegistrationDocuments.documents as any[]) {
    signed[doc.id] = await signDocument(a.wif, doc.document, a.username)
    if (doc.link_to_statement)
      links.push(signed[doc.id].doc_hash)
  }
  const app = await gql<any>(a.token, `mutation($d:ParticipantApplicationGenerateDocumentInput!){
    generateParticipantApplication(data:$d){ full_title html hash meta binary }
  }`, { d: { coopname: COOP, username: a.username, braname: 'krg', links, signature: HAND_SIGNATURE, skip_save: false } })
  const statement = await signDocument(a.wif, app.generateParticipantApplication, a.username)
  return gqlRaw<any>(a.token, REGISTER_PARTICIPANT, {
    d: { username: a.username, braname: 'krg', program_key: programKey, statement, ...signed, intake_answers: intakeAnswers },
  })
}
