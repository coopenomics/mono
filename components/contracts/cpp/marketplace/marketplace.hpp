#pragma once

#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include <string>
#include <vector>

#include "../lib/index.hpp"
#include "../lib/core/marketplace/marketplace.hpp"
#include "../lib/core/marketplace/memo.hpp"
#include "../lib/core/branch/branch.hpp"
#include "../lib/core/ledger2/ledger2.hpp"

using namespace eosio;
using namespace Marketplace;

/**
 * \ingroup public_contracts
 *
 * @brief Контракт `marketplace` — кооперативный «Стол заказов» в режиме
 * членских взносов.
 *
 * Реализует canonical actions трёх процессов из YAML-стандартов:
 *  - **p.mkt.supply** (9 actions): createorder, cancelorder, expireorder,
 *    acceptorder, declineorder, signsupp, signchair, signiss1, signiss2.
 *  - **p.mkt.return** (5 actions): submretrn, aprretrem, rejretrem, accretrn,
 *    rejretrn.
 *  - **p.mkt.wroff** (3 actions): propwroff, execwroff, declwroff.
 *
 * Все per-batch операции на on-chain выполняются per-Order (бэкенд
 * проходит циклом по Order'ам соответствующего batch'а, объединяя их по
 * `batch_hash`). Векторов order_hashes в actions нет — это ограничение
 * на размер транзакции в Antelope (тысячи orders в одной транзакции
 * не пройдут).
 *
 * Все ledger2-движения средств — через `Ledger2::apply(_marketplace, …)`,
 * никаких прямых wallet/account-операций. 13 marketplace-операций
 * зарегистрированы в `lib/core/ledger2/operations.hpp` (`OPERATION_REGISTRY`).
 *
 * Composite-операции (consum+consum2, return+return2, wroff+wroff2) —
 * последовательные `Ledger2::apply` в одной транзакции Antelope (атомарность
 * через single-action wrapper).
 *
 * Авторизация подписей под актами / решениями привязана к кооперативному
 * участку (КУ) через контракт `branch` и helper
 * `Branch::is_user_authorized(coopname, braname, signer)` — председатель
 * КУ может делегировать подпись доверенному лицу из `coobranch.trusted[]`.
 *
 * Источник правды по логике actions, гардам, state-переходам и
 * операциям — три YAML-файла рядом с этим .hpp:
 *  - `p.mkt.supply.standard.yaml`
 *  - `p.mkt.return.standard.yaml`
 *  - `p.mkt.wroff.standard.yaml`
 *
 * Donor-actions старой клиринговой модели (FR19a, AR30) удалены вместе с
 * соответствующими таблицами `Marketplace::request/segment/shipment`.
 */
class [[eosio::contract(MARKETPLACE)]] marketplace : public eosio::contract {

public:
  marketplace(eosio::name receiver, eosio::name code,
              eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  // ── p.mkt.supply ─────────────────────────────────────────────────────

  /**
   * @brief Заказчик размещает заказ на товар из каталога (Story 4.1).
   * Серия: o.wal.conv (conditional) → o.mkt.assign (conditional) → o.mkt.block.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void createorder(eosio::name coopname,
                                      eosio::name orderer,
                                      checksum256 order_hash,
                                      checksum256 offer_hash,
                                      eosio::name offerer,
                                      eosio::name delivery_braname,
                                      uint64_t quantity,
                                      eosio::asset unit_price,
                                      eosio::name cycle_type,
                                      uint32_t warranty_period_secs,
                                      checksum256 batch_hash);

  /**
   * @brief Заказчик отменяет заказ до акцепта (Story 4.4). Триггерит o.mkt.unblk.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void cancelorder(eosio::name coopname,
                                      eosio::name orderer,
                                      checksum256 order_hash);

  /**
   * @brief Backend закрывает Order по таймауту цикла отсечки (Story 4.3).
   * Per-Order: o.mkt.unblk + статус active → cancelled. Backend вычисляет
   * threshold по batch'у вне контракта; для каждого истёкшего Order'а
   * вызывается отдельный `expireorder`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void expireorder(eosio::name coopname,
                                      checksum256 order_hash);

  /**
   * @brief Поставщик акцептует один Order (Story 4.5).
   * Без ledger2-операций — статус active → accepted. Backend проходит циклом
   * по orders соответствующего batch'а, вызывая `acceptorder` per Order.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void acceptorder(eosio::name coopname,
                                      eosio::name offerer,
                                      checksum256 order_hash);

  /**
   * @brief Поставщик отказывается от одного Order'а до акцепта (Story 4.5).
   * Per-Order: o.mkt.unblk на total_cost + статус active → cancelled.
   * Backend проходит циклом по orders батча, вызывая `declineorder` per Order.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void declineorder(eosio::name coopname,
                                       eosio::name offerer,
                                       checksum256 order_hash);

  /**
   * @brief Поставщик первой подписью на АПП приёмки фиксирует партию по одному
   * Order'у (Story 5.3/5.4). Без ledger2-операций — статус accepted →
   * supply_prepared. Параметр `accept_braname` указывает приёмный КУ; запись
   * в Order. Подпись валидируется как `verify_document_or_fail(act, {offerer})`.
   * Backend проходит циклом по orders батча с одинаковым `act`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signsupp(eosio::name coopname,
                                   eosio::name offerer,
                                   checksum256 order_hash,
                                   eosio::name accept_braname,
                                   document2 act);

  /**
   * @brief Председатель приёмного КУ ставит закрывающую подпись на АПП
   * приёмки одного Order'а (Story 5.3/5.4). Per-Order: только o.mkt.purch
   * (Дт 10 / Кт 86). Выплата поставщику (o.mkt.payout) — отдельным lazy
   * action'ом `payout` после подтверждения кассиром фактического банковского
   * перевода (E11 техдолг 598-16, Locked Decision L12). Авторизация подписи:
   * председатель / trustee / trusted ∈ branches[o.accept_braname]. Backend
   * проходит циклом по orders батча с одинаковым `act`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signchair(eosio::name coopname,
                                    eosio::name signer,
                                    checksum256 order_hash,
                                    document2 act);

  /**
   * @brief Lazy-выплата поставщику с расчётного счёта по одному Order'у
   * (E11 техдолг 598-16, Locked Decision L12). Per-Order: o.mkt.payout
   * (Дт 86 / Кт 51) — закрытие обязательства перед поставщиком после
   * подтверждения кассиром фактического банковского перевода. Статус Order'а
   * не меняется; защита от двойного списания — через `order.payout_done`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void payout(eosio::name coopname,
                                 checksum256 order_hash);

  /**
   * @brief Председатель КУ выдачи открывает выдачу первой подписью АПП-выдачи
   * (Story 6.1). Без ledger2-операций — статус ready_to_receive. Авторизация:
   * подписант ∈ branches[o.delivery_braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signiss1(eosio::name coopname,
                                   eosio::name signer,
                                   checksum256 order_hash,
                                   document2 act);

  /**
   * @brief Заказчик ставит финальную подпись АПП-выдачи (Story 6.3).
   * Per-Order с поддержкой actual_quantity ≠ ordered (Story 6.2).
   * Atomic: [o.mkt.unblk на разницу если actual<ordered |
   *          o.wal.conv+o.mkt.assign+o.mkt.block на разницу если actual>ordered]
   *         + o.mkt.consum + o.mkt.consum2.
   * Подпись акта: orderer + любой авторизованный из branches[o.delivery_braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signiss2(eosio::name coopname,
                                   eosio::name orderer,
                                   checksum256 order_hash,
                                   uint64_t actual_quantity,
                                   eosio::name delivery_signer,
                                   document2 act);

  // ── p.mkt.return ─────────────────────────────────────────────────────

  /**
   * @brief Пайщик подаёт заявление на гарантийный возврат (Story 7.1).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void submretrn(eosio::name coopname,
                                    eosio::name orderer,
                                    checksum256 request_hash,
                                    checksum256 original_order_hash,
                                    uint64_t actual_quantity,
                                    std::string reason_text,
                                    std::vector<checksum256> photos,
                                    document2 statement);

  /**
   * @brief Председатель удалённо одобряет очный визит (Story 7.2). Авторизация:
   * подписант ∈ branches[braname]; параметр `braname` фиксирует КУ, в котором
   * рассматривается заявление.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void aprretrem(eosio::name coopname,
                                    eosio::name signer,
                                    eosio::name braname,
                                    checksum256 request_hash,
                                    document2 decision);

  /**
   * @brief Председатель удалённо отказывает (Story 7.2). Авторизация:
   * подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrem(eosio::name coopname,
                                    eosio::name signer,
                                    eosio::name braname,
                                    checksum256 request_hash,
                                    std::string reason,
                                    document2 decision);

  /**
   * @brief Председатель принимает возврат на очном осмотре (Story 7.4).
   * Atomic: o.mkt.return + o.mkt.return2 (compensating forward).
   * Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void accretrn(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash,
                                   document2 decision);

  /**
   * @brief Председатель отказывает на очном осмотре (Story 7.3).
   * Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrn(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash,
                                   std::string reason,
                                   document2 decision);

  // ── p.mkt.wroff ──────────────────────────────────────────────────────

  /**
   * @brief Backend / админ выносит проект списания на повестку совета (Story 8.1).
   * Без ledger2-операций — только создание proposal с N позициями.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void propwroff(eosio::name coopname,
                                    eosio::name proposed_by,
                                    checksum256 proposal_hash,
                                    std::vector<wroff_item> items);

  /**
   * @brief Совет исполняет одну позицию проекта списания (Story 8.3).
   * Per-item: o.mkt.wroff + o.mkt.wroff2 (атомарно в той же транзакции),
   * `items[item_index].executed = true`. Когда все items.executed → proposal
   * status переходит в EXECUTED. Авторизация: подписант ∈ branches[items[item_index].braname].
   * Backend проходит циклом по неисполненным items, вызывая `execwroff` per item.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void execwroff(eosio::name coopname,
                                    eosio::name signer,
                                    checksum256 proposal_hash,
                                    uint64_t item_index,
                                    document2 protocol);

  /**
   * @brief Совет отклоняет проект списания целиком (Story 8.3).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void declwroff(eosio::name coopname,
                                    eosio::name decided_by,
                                    checksum256 proposal_hash,
                                    std::string reason);

  // ── service ──────────────────────────────────────────────────────────

  /**
   * @brief Заглушка миграции — donor-таблиц нет, мигрировать нечего.
   * Оставлена для совместимости с CMake-build и прежним ABI.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void migrate();
};
