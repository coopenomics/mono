/**
 * Онбординг Стола заказов снаружи (реестр marketplace.onboarding): приём ЦПП
 * кооперативом (L1) и подпись программной оферты пайщиком (L3).
 *
 * На стенде ЦПП принята фазой засева 01-l1-accept — решениями совета по
 * шагам онбординга расширения, как в жизни. Состояния «кооператив не
 * подключил ЦПП», «нет программы», «цепь недоступна» на поднятом стенде
 * непредставимы — их случаи живут в юнит-тестах.
 *
 * Подпись оферты необратима, поэтому подписывает свежий пайщик.
 */
import crypto from 'node:crypto'
import ecc from 'eosjs-ecc'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  CHAIRMAN,
  COOP,
  ROLES,
  caseName,
  freshMember,
  gql,
  gqlError,
  login,
  randomAccount,
  signDocument,
  tokenOf,
} from '../core'

/** Шаблон инстанса оферты ЦПП «Стол заказов» (cooptypes 1102.MarketplaceOffer). */
const OFFER_REGISTRY_ID = 1102
/** Положение ЦПП (cooptypes 1100.MarketplaceProgramTemplate) — документ принятия. */
const PROGRAM_TEMPLATE_REGISTRY_ID = 1100
const EXTENSION = 'market'

const CPP_STATUS = 'query{ marketplaceCppStatus{ status document_registry_id accepted_at accepted_by_board_decision_id } }'
const ONBOARDING_STATE = 'query{ marketplaceOnboardingState{ requires_gate source template_registry_id completed_at } }'
const SIGN_OFFER = `mutation($i:MarketplaceSignOnboardingOfferInput!){
  marketplaceSignOnboardingOffer(input:$i){ requires_gate source template_registry_id completed_at }
}`
const ACCEPT_CPP = `mutation($i:MarketplaceAcceptCppInput!){
  marketplaceAcceptCpp(input:$i){ status document_registry_id accepted_at accepted_by_board_decision_id }
}`

/** Инстанс оферты так, как его собирает стол пайщика (OnboardingMemberPickCpp). */
async function generateOffer(token: string, username: string): Promise<any> {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = await gql<any>(token, `mutation($i:GenerateAnyDocumentInput!){
    generateDocument(input:$i){ full_title html hash meta binary }
  }`, {
    i: {
      data: {
        registry_id: OFFER_REGISTRY_ID,
        coopname: COOP,
        username,
        marketplace_agreement_number: crypto.randomBytes(8).toString('hex').toUpperCase(),
        marketplace_agreement_created_at: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
      },
    },
  })
  return d.generateDocument
}

describe('Стол заказов: онбординг кооператива и пайщика', () => {
  let memberToken = ''

  beforeAll(async () => {
    memberToken = await tokenOf(ROLES.member())
  })

  it(caseName('mkt.onb.happy.02', 'ЦПП принята решением совета: статус «принята», решение и дата сохранены'), async () => {
    const d = await gql<any>(memberToken, CPP_STATUS)
    const cpp = d.marketplaceCppStatus
    expect(cpp.status).toBe('active')
    expect(cpp.document_registry_id).toBe(PROGRAM_TEMPLATE_REGISTRY_ID)

    // Решение совета — утверждение Положения шагом онбординга расширения.
    const st = await gql<any>(memberToken, `query($e:String!){
      getExtensionOnboardingState(extension_name:$e){ all_done steps{ step_key done hash } }
    }`, { e: EXTENSION })
    const state = st.getExtensionOnboardingState
    expect(state.all_done).toBe(true)
    const provision = (state.steps as any[]).find(s => s.step_key === 'marketplace_provision')
    expect(provision?.done).toBe(true)
    expect(String(cpp.accepted_by_board_decision_id ?? '').toLowerCase()).toBe(String(provision.hash ?? '').toLowerCase())

    const acceptedAt = Date.parse(cpp.accepted_at)
    expect(Number.isNaN(acceptedAt)).toBe(false)
    expect(acceptedAt).toBeLessThanOrEqual(Date.now() + 60_000)
  })

  it(caseName('mkt.onb.happy.04', 'программа ЦПП открыта в кооперативе, шаблон оферты у программы — от контракта'), async () => {
    const ag = await gql<any>(memberToken, 'query($c:String!){ cooperativeAgreements(coopname:$c){ type program_id draft_id } }', { c: COOP })
    const coagreement = (ag.cooperativeAgreements as any[]).find(a => a.type === 'marketplace')
    expect(coagreement, 'соглашение ЦПП «Стол заказов» заведено в кооперативе').toBeTruthy()
    expect(coagreement.program_id).toBeGreaterThan(0)

    const pr = await gql<any>(memberToken, 'query($c:String!){ cooperativePrograms(coopname:$c){ id draft_id is_active program_type } }', { c: COOP })
    const program = (pr.cooperativePrograms as any[]).find(p => p.id === coagreement.program_id)
    expect(program, `программа ${coagreement.program_id} открыта в кооперативе`).toBeTruthy()
    expect(program.is_active).toBe(true)
    expect(program.draft_id).toBe(OFFER_REGISTRY_ID)
  })

  it(caseName('mkt.onb.side.04', 'повторный приём принятой ЦПП не отказ: реквизиты нового решения перезаписывают прежние'), async () => {
    const chairmanToken = await tokenOf(CHAIRMAN)
    const before = (await gql<any>(chairmanToken, CPP_STATUS)).marketplaceCppStatus
    expect(before.status).toBe('active')

    const marker = `api-tests-${crypto.randomBytes(6).toString('hex')}`
    try {
      const again = (await gql<any>(chairmanToken, ACCEPT_CPP, {
        i: { document_registry_id: before.document_registry_id, accepted_by_board_decision_id: marker },
      })).marketplaceAcceptCpp
      expect(again.status).toBe('active')
      expect(again.accepted_by_board_decision_id).toBe(marker)

      const after = (await gql<any>(memberToken, CPP_STATUS)).marketplaceCppStatus
      expect(after.status).toBe('active')
      expect(after.accepted_by_board_decision_id).toBe(marker)
      expect(after.document_registry_id).toBe(before.document_registry_id)
    }
    finally {
      // Реквизиты решения совета стенда возвращаются: их читают другие наборы.
      await gql(chairmanToken, ACCEPT_CPP, {
        i: { document_registry_id: before.document_registry_id, accepted_by_board_decision_id: before.accepted_by_board_decision_id },
      })
    }
  })

  it(caseName('mkt.onb.side.05', 'подписавший оферту пайщик проходит без гейта: источник «подписано», дата подписи'), async () => {
    const who = freshMember({ prefix: 'onb' })
    const token = await login(who)

    const gate = (await gql<any>(token, ONBOARDING_STATE)).marketplaceOnboardingState
    expect(gate.requires_gate).toBe(true)
    expect(gate.source).toBe('GATE_REQUIRED')
    expect(gate.template_registry_id).toBe(OFFER_REGISTRY_ID)

    const offer = await generateOffer(token, who.account)
    const signed = await signDocument(who.wif, offer, who.account, 1)
    // Транзакция отвечает после своего блока: ответ мутации уже несёт подпись.
    const answered = (await gql<any>(token, SIGN_OFFER, { i: { document: signed } })).marketplaceSignOnboardingOffer
    expect(answered.source).toBe('AGREEMENT_SIGNED')

    const state = (await gql<any>(token, ONBOARDING_STATE)).marketplaceOnboardingState
    expect(state.source).toBe('AGREEMENT_SIGNED')
    expect(state.requires_gate).toBe(false)
    expect(state.completed_at, 'дата подписи проставлена').toBeTruthy()
  })

  it(caseName('mkt.onb.side.10', 'гость не подписывает оферту: отказ по входу'), async () => {
    const err = await gqlError(null, SIGN_OFFER, { i: { document: dummySignedDocument('guest') } })
    expect(err).not.toBeNull()
    expect(String(err!.code)).toBe('401')
  })

  it(caseName('mkt.onb.side.10', 'кандидат, ещё не принятый в пайщики, не подписывает оферту: отказ по членству'), async () => {
    const username = randomAccount('onbc')
    const wif = ecc.seedPrivate(crypto.randomBytes(32).toString('hex'))
    const reg = await gql<any>(null, `mutation($d:RegisterAccountInput!){
      registerAccount(data:$d){ tokens{ access{ token } } account{ username } }
    }`, {
      d: {
        username,
        email: `${username}@api-tests.coop`,
        public_key: ecc.privateToPublic(wif),
        type: 'individual',
        individual_data: {
          first_name: 'Кандидат',
          last_name: 'Внешнийслой',
          middle_name: 'Проверочный',
          birthdate: '1990-01-01',
          phone: '+79000000000',
          full_address: 'г. Москва, ул. Тестовая, д. 1',
        },
      },
    })
    const token = reg.registerAccount.tokens.access.token as string

    const err = await gqlError(token, SIGN_OFFER, { i: { document: dummySignedDocument(username) } })
    expect(err).not.toBeNull()
    expect(err!.code).toBe('MARKETPLACE_NOT_A_MEMBER')

    const readErr = await gqlError(token, ONBOARDING_STATE)
    expect(readErr?.code).toBe('MARKETPLACE_NOT_A_MEMBER')
  })
})

/** Документ, проходящий схему GraphQL: до проверки подписи запрос дойти не должен. */
function dummySignedDocument(signer: string): Record<string, unknown> {
  const h = '0'.repeat(64)
  return {
    version: '1.0.0',
    hash: h,
    doc_hash: h,
    meta_hash: h,
    meta: { registry_id: OFFER_REGISTRY_ID, coopname: COOP, username: signer },
    signatures: [{ id: 1, signer, public_key: 'PUB_K1_none', signature: 'SIG_K1_none', signed_at: new Date().toISOString(), signed_hash: h, meta: '{}' }],
  }
}
