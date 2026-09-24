/**
 * Анкеты при вступлении (registration.intake-forms).
 *
 * Расширение объявляет анкету, ядро показывает её заявителю в конфигурации
 * регистрации и не принимает заявление, пока ответы не проходят схему. Что
 * заполнять, решает сервер: лишняя анкета — такой же отказ, как незаполненная.
 *
 * Анкеты проверяются раньше подписей документов, поэтому заявление здесь
 * подаётся с документами-заглушками: пока ответы не годятся, отказ — про
 * анкету; когда годятся, заявление идёт дальше и упирается уже в проверку
 * документов (PARTICIPATION_DOCUMENT_VALIDATION_FAILED). По этой смене отказа
 * и видно, что анкета принята.
 *
 * Анкету «Генератора» объявляет Благорост при завершённом первом уровне
 * подключения — на стенде он завершён засевом (boot, postgres-init).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, gql, gqlRaw, randomAccount, signDocument, tokenOf } from '../core'
import { REGISTER_ACCOUNT, freshKeyPair, individualData, registerInput } from '../platform/platform-b.helpers'

const CONFIG = `query($t:AccountType!,$c:String!){ getRegistrationConfig(account_type:$t, coopname:$c){
  intake_forms{ id title description order schema }
  programs{ key title intake_forms{ id title description order schema } }
} }`

const REGISTER_PARTICIPANT = `mutation($d:RegisterParticipantInput!){ registerParticipant(data:$d){ username } }`

const GENERATOR_FORM = 'generator_cover_letter'
const DOCS_REFUSAL = 'PARTICIPATION_DOCUMENT_VALIDATION_FAILED'

interface Applicant { username: string, token: string, publicKey: string, wif: string }

/** Гость заводит аккаунт — дальше он подаёт заявление своим токеном. */
async function applicant(): Promise<Applicant> {
  const username = randomAccount('in')
  const { publicKey, wif } = await freshKeyPair()
  const d = await gql<any>(null, `mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ tokens{ access{ token } } } }`, {
    d: registerInput(username, publicKey, 'individual', individualData()),
  })
  return { username, publicKey, wif, token: d.registerAccount.tokens.access.token }
}

/** Подписанный документ-заглушка: форма верная, подпись ничего не значит. */
function dummyDoc(a: Applicant, meta: Record<string, unknown> = {}) {
  const zero = '0'.repeat(64)
  return {
    doc_hash: zero,
    hash: zero,
    meta_hash: zero,
    version: '1.0.0',
    meta,
    signatures: [{ id: 1, signer: a.username, public_key: a.publicKey, signature: 'SIG_K1_dummy', signed_at: new Date().toISOString(), signed_hash: zero, meta: '{}' }],
  }
}

async function submit(a: Applicant, programKey: string, intakeAnswers?: unknown[]) {
  const doc = dummyDoc(a)
  const statement = dummyDoc(a, {
    block_num: 1, braname: '', coopname: COOP, created_at: new Date().toISOString(), generator: 'coopjs', lang: 'ru',
    links: [], registry_id: 100, skip_save: false, timezone: 'Europe/Moscow', title: 'Заявление', username: a.username, version: '1.0.0',
  })
  return gqlRaw<any>(a.token, REGISTER_PARTICIPANT, {
    d: {
      username: a.username,
      program_key: programKey,
      statement,
      wallet_agreement: doc,
      signature_agreement: doc,
      privacy_agreement: doc,
      user_agreement: doc,
      generator_offer: doc,
      blagorost_offer: doc,
      ...(intakeAnswers !== undefined && { intake_answers: intakeAnswers }),
    },
  })
}

/** Собственноручная подпись заявления — картинка 1×1, как её присылает рабочий стол. */
const HAND_SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/**
 * Заявление целиком, как его подаёт рабочий стол: документы вступления
 * программы, подписанные ключом заявителя, и заявление со ссылками на них.
 */
async function fullApplication(a: Applicant, programKey: string, intakeAnswers: unknown[]) {
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

/** Письмо ровно из n знаков, без пробелов по краям — обрезка длину не меняет. */
const letter = (n: number) => 'Письмо'.repeat(Math.ceil(n / 6)).slice(0, n)

describe('registration.intake-forms: анкеты при вступлении', () => {
  let config: any
  let generator: any
  let form: any
  let a: Applicant

  beforeAll(async () => {
    config = (await gql<any>(null, CONFIG, { t: 'individual', c: COOP })).getRegistrationConfig
    generator = (config.programs as any[]).find(p => p.key === 'generation' || p.key === 'GENERATION')
    form = generator?.intake_forms.find((f: any) => f.id === GENERATOR_FORM)
    a = await applicant()
  })

  it(caseName('reg.intake.happy.01', 'анкета в реестре — JSON Schema, описание поля разобрано в объект, обязательные поля перечислены'), () => {
    expect(form, `программы: ${JSON.stringify((config.programs as any[]).map(p => p.key))}`).toBeDefined()
    expect(form.title).toBeTruthy()
    expect(form.schema.type).toBe('object')
    const cover = form.schema.properties.cover_letter
    expect(typeof cover.description).toBe('object')
    expect(cover.description.label).toBeTruthy()
    expect(cover.minLength).toBe(200)
    expect(cover.maxLength).toBe(4000)
    expect(form.schema.required).toEqual(['cover_letter'])
    expect(form.schema.properties.resume_url.format).toBe('uri')
  })

  it(caseName('reg.intake.happy.03', 'общие анкеты отдельно, анкеты программы в программе, без дублей и без владельца-расширения'), () => {
    const common = (config.intake_forms as any[]).map(f => f.id)
    expect(common).not.toContain(GENERATOR_FORM)
    for (const p of config.programs as any[]) {
      const ids = (p.intake_forms as any[]).map(f => f.id)
      expect(new Set(ids).size, p.key).toBe(ids.length)
      for (const f of p.intake_forms as any[]) {
        expect(Object.keys(f).sort()).toEqual(['description', 'id', 'order', 'schema', 'title'])
        expect(JSON.stringify(f)).not.toMatch(/extension_name|"capital"/)
      }
    }
  })

  it(caseName('reg.intake.side.06', 'анкета приходит только через программу: заявителю Благороста письмо не требуется'), async () => {
    const capitalization = (config.programs as any[]).find(p => /capitalization/i.test(p.key))
    expect(capitalization).toBeDefined()
    expect((capitalization.intake_forms as any[]).map(f => f.id)).not.toContain(GENERATOR_FORM)
    const r = await submit(a, 'CAPITALIZATION')
    expect(r.errors[0]?.code).toBe(DOCS_REFUSAL)
  })

  it(caseName('reg.intake.side.03', 'ответ на обязательную анкету не приложен — «<заголовок>: не заполнена»'), async () => {
    for (const answers of [undefined, []]) {
      const r = await submit(a, 'GENERATION', answers)
      expect(String(r.errors[0]?.code)).toBe('400')
      expect(r.errors[0]?.message).toContain(`${form.title}: не заполнена`)
    }
  })

  it(caseName('reg.intake.side.04', 'ответ не проходит схему — замечание с подписью поля и русским сообщением'), async () => {
    const label = form.schema.properties.cover_letter.description.label
    for (const values of [{ cover_letter: 'Коротко' }, { cover_letter: '' }, { cover_letter: 12345 }]) {
      const r = await submit(a, 'GENERATION', [{ form_id: GENERATOR_FORM, values }])
      expect(String(r.errors[0]?.code), JSON.stringify(values)).toBe('400')
      expect(r.errors[0]?.message).toContain(label)
      expect(r.errors[0]?.message).toMatch(/[а-яё]/i)
    }
  })

  it(caseName('reg.intake.side.05', 'анкета, не положенная заявителю (другая программа, выдуманный id), — отказ'), async () => {
    const made = await submit(a, 'GENERATION', [
      { form_id: GENERATOR_FORM, values: { cover_letter: letter(300) } },
      { form_id: 'no_such_form_x', values: {} },
    ])
    expect(String(made.errors[0]?.code)).toBe('400')
    expect(made.errors[0]?.message).toContain('Для этой заявки не предусмотрены анкеты: no_such_form_x')

    const other = await submit(a, 'CAPITALIZATION', [{ form_id: GENERATOR_FORM, values: { cover_letter: letter(300) } }])
    expect(String(other.errors[0]?.code)).toBe('400')
    expect(other.errors[0]?.message).toContain(`Для этой заявки не предусмотрены анкеты: ${GENERATOR_FORM}`)
  })

  it(caseName('reg.intake.happy.02', 'корректные ответы приняты: значения обрезаны, лишние ключи отброшены, у кандидата снимок заголовка и схемы'), async () => {
    const r = await submit(a, 'GENERATION', [{ form_id: GENERATOR_FORM, values: { cover_letter: `  ${letter(300)}  `, extra_field: 'лишнее' } }])
    expect(r.errors[0]?.code).toBe(DOCS_REFUSAL)

    // Заявление целиком: подписанные документы и та же анкета.
    const b = await applicant()
    const text = letter(300)
    const full = await fullApplication(b, 'GENERATION', [{ form_id: GENERATOR_FORM, values: { cover_letter: `  ${text}  `, extra_field: 'лишнее', resume_url: '  https://example.com/cv  ' } }])
    expect(full.errors).toEqual([])
    const intake = (await gql<any>(await tokenOf(CHAIRMAN), `query($u:String!){ getCandidateIntake(username:$u){
      username program_key answers{ form_id title json_schema values submitted_at }
    } }`, { u: b.username })).getCandidateIntake
    expect(intake.program_key).toMatch(/generation/i)
    expect(intake.answers).toHaveLength(1)
    const answer = intake.answers[0]
    expect(answer.form_id).toBe(GENERATOR_FORM)
    expect(answer.values).toEqual({ cover_letter: text, resume_url: 'https://example.com/cv' })
    expect(answer.title).toBe(form.title)
    expect(answer.json_schema).toEqual(form.schema)
    expect(Number.isNaN(Date.parse(answer.submitted_at))).toBe(false)
  })

  it(caseName('reg.intake.side.08', 'письмо на границах длины: минимум−1, минимум, максимум, максимум+1, пробелы по краям'), async () => {
    const cases: [string, boolean][] = [
      [letter(199), false],
      [letter(200), true],
      [letter(4000), true],
      [letter(4001), false],
      [`   ${letter(199)}   `, false],
      [`   ${letter(200)}   `, true],
    ]
    for (const [text, ok] of cases) {
      const r = await submit(a, 'GENERATION', [{ form_id: GENERATOR_FORM, values: { cover_letter: text } }])
      const code = String(r.errors[0]?.code)
      if (ok)
        expect(code, `длина ${text.length}`).toBe(DOCS_REFUSAL)
      else
        expect(code, `длина ${text.length}: ${r.errors[0]?.message}`).toBe('400')
    }
  })

  it(caseName('reg.intake.side.14', 'ссылка на резюме: пусто и http/https проходят, остальное и слишком длинное — замечание'), async () => {
    const cases: [unknown, boolean][] = [
      [undefined, true],
      ['', true],
      ['https://example.com/cv', true],
      ['  http://example.com/cv  ', true],
      ['example.com/cv', false],
      ['просто текст', false],
      ['javascript:alert(1)', false],
      ['ftp://example.com/cv', false],
      ['mailto:a@example.com', false],
      [`https://example.com/${'a'.repeat(500)}`, false],
    ]
    for (const [url, ok] of cases) {
      const values: Record<string, unknown> = { cover_letter: letter(300) }
      if (url !== undefined)
        values.resume_url = url
      const r = await submit(a, 'GENERATION', [{ form_id: GENERATOR_FORM, values }])
      const code = String(r.errors[0]?.code)
      if (ok)
        expect(code, String(url)).toBe(DOCS_REFUSAL)
      else
        expect(code, `${String(url).slice(0, 40)}: ${r.errors[0]?.message}`).toBe('400')
    }
  })
})
