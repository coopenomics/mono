/**
 * Списание скоропорта (реестр marketplace.writeoff, level backend) — снаружи,
 * через API стенда: причина обязательна, проводит списание только
 * председатель своего участка и только после решения совета.
 *
 * Проект списания на кооператив один открытый: если черновик уже есть (крон
 * или соседний сценарий), проверки идут на нём и он не трогается; свой
 * черновик тест снимает за собой.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, ROLES, caseName, gql, gqlError, signDocument, tokenOf } from '../core'
import type { Who } from '../core'
import { KRG } from './flow'

const PROPOSAL_FIELDS = 'id status total_amount items{ braname asset_title quantity amount reason executed }'
const OPEN_DRAFT = `query{ marketplaceOpenWriteoffDraft{ ${PROPOSAL_FIELDS} } }`
const CREATE_DRAFT = `mutation($d:MarketplaceCreateWriteoffDraftInput!){ marketplaceCreateWriteoffDraft(data:$d){ ${PROPOSAL_FIELDS} } }`
const UPDATE_DRAFT = `mutation($d:MarketplaceUpdateWriteoffDraftInput!){ marketplaceUpdateWriteoffDraft(data:$d){ ${PROPOSAL_FIELDS} } }`
const PROPOSAL = `query($id:String!){ marketplaceWriteoffProposal(id:$id){ ${PROPOSAL_FIELDS} } }`
const MEMO_PAYLOAD = `query($d:MarketplaceWriteoffServiceMemoSignablePayloadInput!){
  marketplaceWriteoffServiceMemoSignablePayload(data:$d){ full_title html hash meta binary }
}`
const CONFIRM = `mutation($d:MarketplaceConfirmWriteoffInput!){ marketplaceConfirmWriteoff(data:$d){ id status } }`
const STATEMENT_PAYLOAD = `query($d:MarketplaceWriteoffStatementSignablePayloadInput!){
  marketplaceWriteoffStatementSignablePayload(data:$d){ full_title html hash meta binary }
}`

function item(reason: string) {
  return {
    braname: KRG,
    asset_title: 'Внешний тест: проверка списания',
    quantity: '1',
    amount: '1.0000',
    reason,
    inventory_ids: [],
  }
}

let chairmanToken = ''
let krgChairman: Who
let odnChairman: Who
let krgToken = ''
let odnToken = ''
/** Черновик, на котором идут проверки; свой — снимается в конце. */
let draft: any = null
let ownDraft = false

beforeAll(async () => {
  chairmanToken = await tokenOf(CHAIRMAN)
  krgChairman = ROLES.branchChairman()
  odnChairman = ROLES.foreignBranchChairman()
  krgToken = await tokenOf(krgChairman)
  odnToken = await tokenOf(odnChairman)
})

afterAll(async () => {
  if (ownDraft && draft)
    await gql(chairmanToken, 'mutation($id:String!){ marketplaceCancelWriteoffDraft(id:$id) }', { id: draft.id })
})

describe('списание скоропорта: состав проекта и кто его проводит', () => {
  it(caseName('mkt.wof.side.01', 'проект списания без причины — отказ, черновик не меняется'), async () => {
    const open = (await gql<any>(chairmanToken, OPEN_DRAFT)).marketplaceOpenWriteoffDraft
    for (const reason of ['', '   ']) {
      const err = open
        ? await gqlError(chairmanToken, UPDATE_DRAFT, { d: { id: open.id, items: [item(reason)] } })
        : await gqlError(chairmanToken, CREATE_DRAFT, { d: { items: [item(reason)] } })
      expect(err?.code, `причина обязательна («${reason}»)`).toBe('MARKETPLACE_WRITEOFF_ITEM_REASON_REQUIRED')
    }
    if (open) {
      const after = (await gql<any>(chairmanToken, PROPOSAL, { id: open.id })).marketplaceWriteoffProposal
      expect(after.items, 'состав черновика прежний').toEqual(open.items)
    }
    else {
      expect((await gql<any>(chairmanToken, OPEN_DRAFT)).marketplaceOpenWriteoffDraft, 'черновик без причины не создан').toBeNull()
    }
  })

  describe('проект до решения совета', () => {
    let memo: any
    let statement: any

    beforeAll(async () => {
      draft = (await gql<any>(chairmanToken, OPEN_DRAFT)).marketplaceOpenWriteoffDraft
      if (!draft) {
        draft = (await gql<any>(chairmanToken, CREATE_DRAFT, { d: { items: [item('Внешний тест: порча при хранении.')] } })).marketplaceCreateWriteoffDraft
        ownDraft = true
      }
      // Служебную записку по проекту, который совет ещё не утвердил, сервер не
      // выдаёт — подписываем тем же ключом председателя участка любой
      // документ проекта: отказ обязан прийти раньше проверки подписи.
      const pl = await gql<any>(chairmanToken, STATEMENT_PAYLOAD, { d: { draft_id: draft.id } })
      statement = pl.marketplaceWriteoffStatementSignablePayload
      memo = await signDocument(krgChairman.wif, statement, krgChairman.account, 1)
    })

    it(caseName('mkt.wof.side.04', 'провести списание до утверждения советом нельзя'), async () => {
      expect(draft.status, 'проект ещё не утверждён советом').toBe('DRAFT')

      const payload = await gqlError(krgToken, MEMO_PAYLOAD, { d: { braname: KRG, proposal_id: draft.id } })
      expect(payload?.code, 'служебная записка до решения совета не формируется').toBe('MARKETPLACE_WRITEOFF_NOT_AWAITING_CONFIRMATION')

      const confirm = await gqlError(krgToken, CONFIRM, { d: { braname: KRG, proposal_id: draft.id, signed_memo: memo } })
      expect(confirm?.code, 'без протокола совета списание не проводится').toBe('MARKETPLACE_WRITEOFF_NOT_AWAITING_CONFIRMATION_WITH_STATUS')

      const after = (await gql<any>(chairmanToken, PROPOSAL, { id: draft.id })).marketplaceWriteoffProposal
      expect(after.status, 'проект на прежнем этапе').toBe('DRAFT')
      expect(after.items.every((i: any) => !i.executed), 'ни одна позиция не списана').toBe(true)
    })

    it(caseName('mkt.wof.side.02', 'имущество чужого участка — председатель другого участка получает отказ доступа'), async () => {
      const payload = await gqlError(odnToken, MEMO_PAYLOAD, { d: { braname: KRG, proposal_id: draft.id } })
      expect(payload?.code, 'записку по чужому участку не выдают').toBe('MARKETPLACE_WRITEOFF_CONFIRM_NOT_TRUSTEE')

      const signed = await signDocument(odnChairman.wif, statement, odnChairman.account, 1)
      const confirm = await gqlError(odnToken, CONFIRM, { d: { braname: KRG, proposal_id: draft.id, signed_memo: signed } })
      expect(confirm?.code, 'списать имущество чужого участка нельзя').toBe('MARKETPLACE_WRITEOFF_CONFIRM_NOT_TRUSTEE')

      const after = (await gql<any>(chairmanToken, PROPOSAL, { id: draft.id })).marketplaceWriteoffProposal
      expect(after.items.every((i: any) => !i.executed), 'ни одна позиция не списана').toBe(true)
    })
  })
})
