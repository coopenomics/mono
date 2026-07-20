#pragma once

#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>

#include "../../core/utils.hpp"

/**
 * @file memo.hpp
 * @brief Человекочитаемые memo для marketplace ledger2-операций.
 *
 * Аналог `Capital::Memo` (см. `cpp/capital/domain/entities/memo.hpp`).
 * Текст memo попадает в журнал ledger2 (поле `journal.memo`) и в выписки
 * пайщика / отчёт бухгалтеру — это пользовательский слой, поэтому никаких
 * технических токенов ("p.mkt.supply", "L6", op_code) здесь быть не должно.
 *
 * Параметризуется значимыми идентификаторами (id Order'а) — для трассировки
 * в выписке без необходимости резолвить hash через backend.
 */
namespace Marketplace::Memo {

  // ---------------------------------------------------------------- p.mkt.supply

  inline std::string get_create_order_block_memo(uint64_t order_id) {
    return "Резерв средств под заказ имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_create_order_assign_memo(uint64_t order_id) {
    return "Целевое назначение взноса под заказ имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_create_order_convert_memo(uint64_t order_id) {
    return "Конвертация паевого взноса в членский для заказа имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_stock_order_block_memo(uint64_t order_id) {
    return "Резерв средств под заказ имущества № " + std::to_string(order_id) + " со склада кооператива";
  }

  inline std::string get_convert_to_member_memo() {
    return "Конвертация паевого взноса в членский кошелёк Стола заказов по заявлению пайщика";
  }

  inline std::string get_membership_fee_lock_memo(uint64_t order_id) {
    return "Членский взнос по заказу имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_membership_fee_refund_memo(uint64_t order_id) {
    return "Возврат членского взноса по заказу имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_membership_fee_topup_memo(uint64_t order_id) {
    return "Доначисление членского взноса по фактической выдаче заказа имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_membership_fee_distribute_memo(uint64_t order_id) {
    return "Членский взнос по заказу имущества № " + std::to_string(order_id) + " в общий кошелёк кооперативного участка";
  }

  inline std::string get_markdown_loss_memo(uint64_t order_id) {
    return "Уценка имущества при выдаче со склада кооператива по заказу № " + std::to_string(order_id);
  }

  inline std::string get_cancel_order_memo(uint64_t order_id) {
    return "Возврат резерва по отменённому заказу имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_refusal_penalty_transit_memo(uint64_t order_id) {
    return "Удержание при отказе от получения по заказу имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_refusal_penalty_distribute_memo(uint64_t order_id) {
    return "Удержание при отказе от получения по заказу имущества № " + std::to_string(order_id) + " в общий кошелёк кооперативного участка";
  }

  inline std::string get_decline_order_memo(uint64_t order_id) {
    return "Возврат резерва по отклонённому поставщиком заказу имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_expire_order_memo(uint64_t order_id) {
    return "Возврат резерва по неисполненному в срок заказу имущества № " + std::to_string(order_id) + " в Столе заказов";
  }

  inline std::string get_purchase_from_supplier_memo(uint64_t order_id) {
    return "Приёмка имущества от поставщика по заказу № " + std::to_string(order_id) + " на склад кооператива";
  }

  inline std::string get_pay_supplier_memo(uint64_t order_id) {
    return "Оплата поставщику имущества по заказу № " + std::to_string(order_id);
  }

  inline std::string get_signiss2_correction_less_memo(uint64_t order_id) {
    return "Возврат разницы пайщику: фактически выдано меньше заказанного по заказу имущества № " + std::to_string(order_id);
  }

  inline std::string get_signiss2_correction_more_convert_memo(uint64_t order_id) {
    return "Конвертация паевого взноса в членский на доплату по заказу имущества № " + std::to_string(order_id) + " (фактически выдано больше заказанного)";
  }

  inline std::string get_signiss2_correction_more_assign_memo(uint64_t order_id) {
    return "Целевое назначение взноса на доплату по заказу имущества № " + std::to_string(order_id) + " (фактически выдано больше заказанного)";
  }

  inline std::string get_signiss2_correction_more_block_memo(uint64_t order_id) {
    return "Резерв на доплату по заказу имущества № " + std::to_string(order_id) + " (фактически выдано больше заказанного)";
  }

  inline std::string get_consume_by_member_memo(uint64_t order_id) {
    return "Выдача имущества пайщику по заказу № " + std::to_string(order_id) + ": выбытие со склада";
  }

  inline std::string get_consume_transit_close_memo(uint64_t order_id) {
    return "Выдача имущества пайщику по заказу № " + std::to_string(order_id) + ": списание целевого назначения членского взноса";
  }

  // ---------------------------------------------------------------- p.mkt.return

  inline std::string get_return_by_member_memo(uint64_t return_request_id, uint64_t order_id) {
    return "Гарантийный возврат имущества пайщиком по заявлению № " + std::to_string(return_request_id) + " (исходный заказ № " + std::to_string(order_id) + "): восстановление членского взноса";
  }

  inline std::string get_return_transit_close_memo(uint64_t return_request_id, uint64_t order_id) {
    return "Гарантийный возврат имущества пайщиком по заявлению № " + std::to_string(return_request_id) + " (исходный заказ № " + std::to_string(order_id) + "): возврат имущества на склад";
  }

  // ---------------------------------------------------------------- p.mkt.wroff

  inline std::string get_writeoff_memo(uint64_t proposal_id, uint64_t item_index) {
    return "Утилизация скоропорта по решению совета № " + std::to_string(proposal_id) + ", позиция " + std::to_string(item_index + 1) + ": выбытие со склада";
  }

  inline std::string get_writeoff_transit_close_memo(uint64_t proposal_id, uint64_t item_index) {
    return "Утилизация скоропорта по решению совета № " + std::to_string(proposal_id) + ", позиция " + std::to_string(item_index + 1) + ": списание целевого назначения";
  }

} // namespace Marketplace::Memo
