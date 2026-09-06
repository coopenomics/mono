import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { Selector, type ValueTypes } from '../../zeus/index'
import { rawDocumentSelector } from '../common/documentSelector'
import { documentAggregateSelector } from '../documents/documentAggregateSelector'
import { rawSignedBlockchainDocumentSelector } from '../documents/signedBlockchainDocumentSelector'

/**
 * Подписанный документ саги (заявление, протокол, акт) — те же поля, что у
 * документа блокчейна: версия, хэши, мета и подписи.
 */
export const rawSignedDigitalDocumentSelector = rawSignedBlockchainDocumentSelector

const rawIssuanceFactSelector = {
  actual_quantity: true,
  actual_unit_price: true,
  fact_cost: true,
}

const _validateFact: MakeAllFieldsRequired<ValueTypes['MarketplaceIssuanceFact']> = rawIssuanceFactSelector

/**
 * Сага выдачи имущества (компонент 68, паевая модель): факт → заявление о
 * возврате паевого взноса имуществом → решение совета (робот / люди) → акт с
 * подписью заказчика → закрывающая подпись оператора. Флаги `awaits_*`
 * говорят экрану, чей ход сейчас; `decision_mode` — ждать ли у стойки.
 */
export const rawIssuanceSagaSelector = {
  id: true,
  order_id: true,
  order_hash: true,
  proposal_id: true,
  member_account: true,
  operator_account: true,
  braname: true,
  stage: true,
  decision_mode: true,
  fact: rawIssuanceFactSelector,
  decision_id: true,
  statement_document: rawSignedDigitalDocumentSelector,
  protocol_document: rawSignedDigitalDocumentSelector,
  act1_document: rawSignedDigitalDocumentSelector,
  act2_document: rawSignedDigitalDocumentSelector,
  awaits_member_signature: true,
  awaits_operator_close: true,
  awaits_council: true,
  last_error: true,
  decided_at: true,
  closed_at: true,
  created_at: true,
  updated_at: true,
}

const _validateSaga: MakeAllFieldsRequired<ValueTypes['MarketplaceIssuanceSaga']> = rawIssuanceSagaSelector

export const marketplaceIssuanceSagaSelector = Selector('MarketplaceIssuanceSaga')(rawIssuanceSagaSelector)

/** Ответ фиксации факта: сага + заявление к подписи заказчиком. */
export const marketplaceIssuanceStatementPayloadSelector = Selector('MarketplaceIssuanceStatementPayload')({
  saga: rawIssuanceSagaSelector,
  statement: rawDocumentSelector,
})

/** Нагрузка к закрывающей подписи оператора: сага + акт с подписью заказчика. */
export const marketplaceIssuanceClosePayloadSelector = Selector('MarketplaceIssuanceClosePayload')({
  saga: rawIssuanceSagaSelector,
  act: documentAggregateSelector,
})
