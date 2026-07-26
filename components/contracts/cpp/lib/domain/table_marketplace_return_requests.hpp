#pragma once

#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <string>
#include <vector>

#include "../consts.hpp"
#include "../core/document.hpp"
#include "../core/utils.hpp"

namespace Marketplace {

using namespace eosio;

/**
 * @brief Рабочие статусы заявления на гарантийный возврат (процесс p.mkt.return).
 *
 * Граф: ∅ → pending_review → approved_for_visit → терминал
 *                          → терминал
 *
 * Терминалы (accretrn / rejretrn / rejretrem) запись СТИРАЮТ из RAM —
 * финальных статусов в таблице не бывает, история и причины отказов — в
 * журнале действий. Источник правды — `p.mkt.return.standard.yaml`.
 */
namespace ReturnStatus {
  inline constexpr eosio::name PENDING_REVIEW       = "pendrev"_n;
  inline constexpr eosio::name APPROVED_FOR_VISIT   = "approvvisit"_n;
}

/**
 * @brief On-chain Заявление на гарантийный возврат — анкер процесса p.mkt.return.
 *
 * scope = coopname; primary_key = id; уникальность через `byhash` индекс на
 * `return_request.hash` — этот hash используется как `process_hash` во всех
 * ledger2-операциях процесса (RETURN + RETURN2).
 *
 * Привязка к КУ не сохраняется — она может измениться от шага к шагу
 * (председатель delivery-КУ может рассмотреть удалённо, а очный осмотр сделать
 * на любом другом КУ; состав доверенных лиц коробки `branches` тоже может
 * меняться). На каждом действии (aprretrem/rejretrem/accretrn/rejretrn) braname
 * приходит параметром action'а и валидируется через
 * `Branch::is_user_authorized(coopname, braname, signer)`. Контракт хранит
 * только неизменные участники процесса: orderer / offerer (через original Order)
 * и coopname.
 *
 * Связь с исходным Order'ом — `original_order_id` + `original_order_hash`;
 * Order.return_request_id ставится в submretrn для двусторонней связи.
 *
 * `photos` — vector<checksum256> хешей файлов в bucket'е stol-zakazov:images
 * (Story 7.1, AR32). Реальные изображения off-chain в file-storage (PR #359);
 * on-chain — только ссылки (hash для дедупликации + URL восстанавливает backend).
 *
 * `statement` — заявление пайщика на возврат (его подпись с submretrn).
 * При принятии возврата (accretrn) председатель накладывает на тот же
 * документ вторую подпись (канон двухподписных актов — без регенерации);
 * со-подписанная версия фиксируется аргументом действия в журнале, запись
 * при этом стирается. Отдельных документов решения председателя нет:
 * удалённое рассмотрение и отказы — процедурные действия с текстовой
 * причиной в аргументе действия.
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] return_request {
  uint64_t id;
  checksum256 hash;                                           ///< process_hash для p.mkt.return
  eosio::name coopname;
  eosio::name orderer;                                        ///< пайщик-заказчик (заявитель)

  uint64_t original_order_id;                                 ///< внутренний id Order'а
  checksum256 original_order_hash;                            ///< process_hash оригинального p.mkt.supply
  checksum256 original_consume_op_id;                         ///< ссылка на оригинальный o.mkt.consum (для journal трассировки compensating forward; см. d6 A4)

  eosio::asset actual_quantity = asset(0, _unit_piece);       ///< возвращаемое количество (asset единицы; по умолчанию = order.actual_quantity, может быть меньше)
  eosio::asset fact_cost = asset(0, _root_govern_symbol);     ///< возвращаемая стоимость имущества (actual_quantity * unit_price / 10^precision)

  /**
   * Доля членского взноса, приходящаяся на возвращаемое имущество. Считается
   * при подаче заявления пропорционально возвращаемому количеству от взноса,
   * фактически принятого кооперативом на выдаче заказа. При приёме возврата
   * возвращается пайщику вместе со стоимостью имущества — из общего кошелька
   * участка, куда взнос ушёл на выдаче (o.brn.retfee + o.mkt.refund).
   * Возврат при полном количестве возвращает пайщику ровно ту сумму, которую
   * он заплатил за заказ.
   *
   * binary_extension — поле добавлено к живой таблице; отсутствие значения у
   * старых заявлений эквивалентно «взнос не возвращается».
   */
  eosio::binary_extension<eosio::asset> fee_refund;

  std::string reason_text;                                    ///< причина обращения (≤ 500 символов)
  std::vector<checksum256> photos;                            ///< хеши файлов в bucket'е stol-zakazov:images

  eosio::name status = ReturnStatus::PENDING_REVIEW;
  document2 statement;                                        ///< заявление пайщика (его подпись)

  // Timestamp'ы submretrn/aprretrem/rejretrem/accretrn/rejretrn — на бэкенде
  // из blockchain_actions[at]. В контракте никаких guard'ов по датам нет.

  uint64_t primary_key()           const { return id; }
  checksum256 by_hash()            const { return hash; }
  uint64_t by_orderer()            const { return orderer.value; }
  uint64_t by_status()             const { return status.value; }
  uint64_t by_original_order()     const { return original_order_id; }
};

typedef eosio::multi_index<
    "retrequests"_n, return_request,
    eosio::indexed_by<"byhash"_n,        eosio::const_mem_fun<return_request, checksum256, &return_request::by_hash>>,
    eosio::indexed_by<"byorderer"_n,     eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_orderer>>,
    eosio::indexed_by<"bystatus"_n,      eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_status>>,
    eosio::indexed_by<"byorigorder"_n,   eosio::const_mem_fun<return_request, uint64_t,    &return_request::by_original_order>>>
    return_requests_index;

} // namespace Marketplace
