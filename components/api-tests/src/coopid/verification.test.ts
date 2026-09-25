/**
 * CoopID: верификация личности пайщика (test-registry/coopid.verification.yaml).
 *
 * Уровни — независимые факты: начальный (CoopBaseline) выводится из принятого
 * членства, базовый (PassportOnsite) пишется в цепь действием verifyacc, когда
 * личность с паспортом сверил участок (председатель участка, участок указан)
 * либо совет (председатель кооператива, участок не указан). Данные для сверки
 * сервер отдаёт только тому, кто вправе сверять, и только пока личность не
 * подтверждена.
 *
 * Сверка меняет состояние пайщика необратимо, поэтому каждый сценарий берёт
 * свежего пайщика.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COOP_SIGNER, COUNCIL, ROLES, amount, caseName, ensureShareFunds, expectAuthDenied, freshMember, gqlRaw, login, randomAccount, tokenOf, transact, type Who } from '../core'
import { KRG, acceptToCoop, labelInventory, pickOffer, placeOrder } from '../marketplace/flow'
import { BRANCH, certificateLevels, chainVerifications, identityFor, joinMarketplace, photo, unverify, verifyOk, verifyOnsite } from './coopid-a.helpers'

const FIRST = 'Верификат'
const LAST = 'Внешнийслой'
const MIDDLE = 'Сверочный'

describe('coopid.verification: уровни верификации и данные для сверки', () => {
  let chairmanToken = ''
  let branchToken = ''
  let branchChairman: Who

  beforeAll(async () => {
    branchChairman = ROLES.branchChairman()
    chairmanToken = await tokenOf(CHAIRMAN)
    branchToken = await tokenOf(branchChairman)
  })

  describe('сверка на участке и советом', () => {
    let atBranch: Who
    let byCouncil: Who

    beforeAll(() => {
      atBranch = freshMember({ prefix: 'cvb', firstName: FIRST, lastName: LAST, middleName: MIDDLE })
      byCouncil = freshMember({ prefix: 'cvc' })
    })

    it(caseName('cid.ver.happy.09', 'председатель участка получает данные пайщика для сверки: ФИО, дата рождения, паспорт целиком, адрес'), async () => {
      const r = await identityFor(branchToken, atBranch.account, BRANCH)
      expect(r.errors).toEqual([])
      const id = r.data!.participantIdentityForVerification
      expect(id.username).toBe(atBranch.account)
      expect(id.type).toBe('individual')
      expect(id.full_name).toBe(`${LAST} ${FIRST} ${MIDDLE}`)
      expect(id.birthdate).toMatch(/1990/)
      expect(id.passport_series).toBe('1111')
      expect(id.passport_number).toMatch(/^\d{6}$/)
      expect(id.passport_issued_by).toBe('УФМС России (тест)')
      expect(id.passport_issued_at).toMatch(/2010/)
      expect(id.passport_code).toBe('000-000')
      expect(id.full_address).toBe('Тестовый адрес')
    })

    it(caseName('cid.ver.happy.02', 'после сверки на участке пайщик получает оба уровня: начальный из членства и базовый с автором проверки'), async () => {
      const levels = await verifyOk(branchToken, atBranch.account, { braname: BRANCH, photos: [photo()] })
      const baseline = levels.find(l => l.type === 'CoopBaseline')
      const passport = levels.find(l => l.type === 'PassportOnsite')
      expect(baseline, 'начальный уровень из принятого членства').toBeTruthy()
      expect(baseline!.source).toBe('CooperativeDecision')
      expect(baseline!.status).toBe('Verified')
      expect(passport, 'базовый уровень из записи участка').toBeTruthy()
      expect(passport!.status).toBe('Verified')
      expect(passport!.attested_by).toBe(branchChairman.account)
      expect(passport!.verified_at).toBeTruthy()
      expect(levels.filter(l => l.type === 'PassportOnsite')).toHaveLength(1)
    })

    it(caseName('cid.ver.happy.07', 'источник уровня: сверка на участке — участок рядом, сверка советом — участок пуст'), async () => {
      const branchLevels = await certificateLevels(atBranch)
      const atBranchPassport = branchLevels.find(l => l.type === 'passport_onsite')
      expect(atBranchPassport).toBeTruthy()
      expect(atBranchPassport!.source).toBe('branch_attestation')
      expect(atBranchPassport!.attested_in).toBe(BRANCH)

      const levels = await verifyOk(chairmanToken, byCouncil.account)
      const passport = levels.find(l => l.type === 'PassportOnsite')
      expect(passport).toBeTruthy()
      expect(passport!.source).toBe('CouncilAttestation')
      expect(passport!.attested_by).toBe(CHAIRMAN.account)
      expect(passport!.attested_in ?? '').toBe('')

      // Контекст сверки контракт пишет в notice как «кооператив/участок».
      const chain = await chainVerifications(chairmanToken, byCouncil.account)
      expect(chain.find(v => v.procedure === 'passport')?.notice).toBe(`${COOP}/`)
    })

    it(caseName('cid.ver.happy.03', 'удостоверение выводит уровни: начальный из членства, базовый с автором проверки'), async () => {
      const levels = await certificateLevels(atBranch)
      const baseline = levels.find(l => l.type === 'coop_baseline')
      const passport = levels.find(l => l.type === 'passport_onsite')
      expect(baseline?.source).toBe('cooperative_decision')
      expect(baseline?.attested_by).toBeUndefined()
      expect(passport?.source).toBe('branch_attestation')
      expect(passport?.attested_by).toBe(branchChairman.account)

      const council = (await certificateLevels(byCouncil)).find(l => l.type === 'passport_onsite')
      expect(council?.source).toBe('council_attestation')
      expect(council?.attested_by).toBe(CHAIRMAN.account)
      expect(council?.attested_in).toBeUndefined()
    })

    it(caseName('cid.ver.side.12', 'данные пайщика с подтверждённой личностью больше не выдаются — ни участку, ни совету'), async () => {
      const onBranch = await identityFor(branchToken, atBranch.account, BRANCH)
      expect(onBranch.data).toBeNull()
      expect(onBranch.errors[0]?.code).toBe('AUTH_V2_IDENTITY_ALREADY_VERIFIED')

      const byChairman = await identityFor(chairmanToken, byCouncil.account)
      expect(byChairman.data).toBeNull()
      expect(byChairman.errors[0]?.code).toBe('AUTH_V2_IDENTITY_ALREADY_VERIFIED')
    })
  })

  describe('уровня не дают отозванные и незнакомые процедуры', () => {
    let who: Who

    beforeAll(() => {
      who = freshMember({ prefix: 'cvr' })
    })

    it(caseName('cid.ver.side.05', 'онлайн-верификация в векторе аккаунта уровня не даёт'), async () => {
      // Незнакомая резолверу процедура online: её проводит провайдер (voskhod)
      // прямо в цепи — это подготовка состояния, проверяемое читается через API.
      await transact(COOP_SIGNER, [{
        account: 'registrator',
        name: 'verificate',
        data: { username: who.account, procedure: 'online' },
      }])
      const chain = await chainVerifications(chairmanToken, who.account)
      expect(chain.some(v => v.procedure === 'online' && v.is_verified)).toBe(true)

      const levels = await certificateLevels(who)
      expect(levels.map(l => l.type)).toEqual(['coop_baseline'])
    })

    it(caseName('cid.ver.side.05', 'отозванная верификация по паспорту уровня не даёт'), async () => {
      const verified = await verifyOk(chairmanToken, who.account)
      expect(verified.some(l => l.type === 'PassportOnsite')).toBe(true)

      const r = await unverify(chairmanToken, who.account)
      expect(r.errors).toEqual([])
      expect(r.data!.unverifyParticipant.map(l => l.type)).toEqual(['CoopBaseline'])
      expect((await certificateLevels(who)).map(l => l.type)).toEqual(['coop_baseline'])
    })
  })

  describe('кто вправе сверять и видеть данные', () => {
    let probe: Who

    beforeAll(() => {
      probe = freshMember({ prefix: 'cva' })
    })

    it(caseName('cid.ver.side.14', 'на участке сверяет его председатель, без участка — председатель совета'), async () => {
      const branch = await identityFor(branchToken, probe.account, BRANCH)
      expect(branch.errors).toEqual([])
      expect(branch.data!.participantIdentityForVerification.username).toBe(probe.account)

      const council = await identityFor(chairmanToken, probe.account)
      expect(council.errors).toEqual([])
      expect(council.data!.participantIdentityForVerification.username).toBe(probe.account)
    })

    it(caseName('cid.ver.side.14', 'председатель чужого участка и председатель совета не сверяют на участке krg'), async () => {
      const foreign = await verifyOnsite(await tokenOf(ROLES.foreignBranchChairman()), probe.account, { braname: BRANCH, photos: [photo()] })
      expect(foreign.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_BRANCH_AUTHORITY_ONLY')

      const chairmanAtBranch = await verifyOnsite(chairmanToken, probe.account, { braname: BRANCH, photos: [photo()] })
      expect(chairmanAtBranch.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_BRANCH_AUTHORITY_ONLY')
    })

    it(caseName('cid.ver.side.14', 'член совета без роли председателя не сверяет от имени совета'), async () => {
      const r = await verifyOnsite(await tokenOf(COUNCIL), probe.account)
      expect(r.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_CHAIRMAN_ONLY')
    })

    it(caseName('cid.ver.side.14', 'несуществующий участок — отказ'), async () => {
      const r = await verifyOnsite(branchToken, probe.account, { braname: 'nobranch', photos: [photo()] })
      expect(r.errors[0]?.code).toBe('AUTH_V2_BRANCH_NOT_FOUND')
    })

    it(caseName('cid.ver.side.14', 'отзыв верификации — только председатель совета'), async () => {
      for (const who of [COUNCIL, branchChairman]) {
        const r = await unverify(await tokenOf(who), probe.account)
        expect(r.errors[0]?.code, who.account).toBe('AUTH_V2_VERIFICATION_REVOKE_CHAIRMAN_ONLY')
      }
    })

    it(caseName('cid.ver.side.14', 'после всех отказов личность пробного пайщика не подтверждена'), async () => {
      expect((await certificateLevels(probe)).map(l => l.type)).toEqual(['coop_baseline'])
    })

    it(caseName('cid.ver.side.13', 'пайщик без полномочий не получает данные — ни на участке, ни от имени совета'), async () => {
      const memberToken = await tokenOf(ROLES.member())
      const onBranch = await identityFor(memberToken, probe.account, BRANCH)
      expect(onBranch.data).toBeNull()
      expect(onBranch.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_BRANCH_AUTHORITY_ONLY')

      const asCouncil = await identityFor(memberToken, probe.account)
      expect(asCouncil.data).toBeNull()
      expect(asCouncil.errors[0]?.code).toBe('AUTH_V2_VERIFICATION_CHAIRMAN_ONLY')
    })

    it(caseName('cid.ver.side.13', 'гость не получает данные'), async () => {
      const r = await identityFor(null, probe.account, BRANCH)
      expect(r.data).toBeNull()
      expectAuthDenied(r.errors[0] ?? null)
    })

    it(caseName('cid.ver.side.13', 'по аккаунту, который не пайщик этого кооператива, — отказ «пайщик не найден»'), async () => {
      const r = await identityFor(chairmanToken, randomAccount('cvx'))
      expect(r.data).toBeNull()
      expect(r.errors[0]?.code).toBe('AUTH_V2_PARTICIPANT_NOT_FOUND')
    })
  })

  describe('выдача имущества без базовой верификации', () => {
    const CREATE_BUNDLE = `mutation($d:MarketplaceCreateStockProposalInput!){
      marketplaceCreateStockProposal(data:$d){ id status member_account braname }
    }`

    it(caseName('cid.ver.side.07', 'оператор фиксирует выдачу получателю без базового уровня — отказ до заявления и акта'), async () => {
      const who = freshMember({ prefix: 'cvi' })
      const token = await login(who)
      await joinMarketplace(who, token)

      const supplier = ROLES.supplier()
      const offer = await pickOffer(supplier.account, KRG, 'Мёд цветочный')
      const price = amount(offer.price_per_unit)
      await ensureShareFunds(who.account, price * 4 + 1_000, token)
      const { orderId } = await placeOrder({ who, offerId: offer.id, quantity: 1 })
      await acceptToCoop({ supplier, operator: branchChairman, orderId, factQuantity: 1, factUnitPrice: price })
      await labelInventory(branchToken, orderId)

      const bundle = { d: { braname: KRG, member_account: who.account, order_items: [{ order_id: orderId, actual_quantity: 1, actual_unit_price: price.toFixed(4) }] } }
      const refused = await gqlRaw(branchToken, CREATE_BUNDLE, bundle)
      expect(refused.data).toBeNull()
      expect(refused.errors[0]?.code).toBe('MARKETPLACE_ISSUANCE_IDENTITY_NOT_VERIFIED')

      // Единственное, чего не хватало, — сверка личности: после неё тот же факт принимается.
      await verifyOk(branchToken, who.account, { braname: BRANCH, photos: [photo()] })
      const accepted = await gqlRaw<any>(branchToken, CREATE_BUNDLE, bundle)
      expect(accepted.errors).toEqual([])
      expect(accepted.data.marketplaceCreateStockProposal.member_account).toBe(who.account)
    })
  })
})
