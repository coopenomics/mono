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
#include "../lib/core/ledger2/ledger2.hpp"

using namespace eosio;
using namespace Marketplace;

/**
 * \ingroup public_contracts
 *
 * @brief Контракт `marketplace` — кооперативный «Стол заказов» в режиме
 * членских взносов.
 *
 * Реализует 18 canonical actions трёх процессов из YAML-стандартов:
 *  - **p.mkt.supply** (10 actions): createorder, cancelorder, expirecycle,
 *    acceptbatch, declinebatch, prepship, signsupp, signchair, signiss1, signiss2.
 *  - **p.mkt.return** (5 actions): submretrn, aprretrem, rejretrem, accretrn,
 *    rejretrn.
 *  - **p.mkt.wroff** (3 actions): propwroff, execwroff, declwroff.
 *
 * Все ledger2-движения средств — через `Ledger2::apply(_marketplace, …)`,
 * никаких прямых wallet/account-операций. 13 marketplace-операций
 * зарегистрированы в `lib/core/ledger2/operations.hpp` (`OPERATION_REGISTRY`).
 *
 * Composite-операции (consum+consum2, return+return2, wroff+wroff2) —
 * последовательные `Ledger2::apply` в одной транзакции Antelope (атомарность
 * через single-action wrapper).
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
                                      eosio::name ku_chairman,
                                      uint64_t quantity,
                                      eosio::asset unit_price,
                                      eosio::name cycle_type,
                                      uint32_t warranty_period_secs);

  /**
   * @brief Заказчик отменяет заказ до акцепта (Story 4.4). Триггерит o.mkt.unblk.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void cancelorder(eosio::name coopname,
                                      eosio::name orderer,
                                      checksum256 order_hash);

  /**
   * @brief Backend закрывает цикл отсечки заявок (Story 4.3).
   * Если threshold не достигнут — для каждого order: o.mkt.unblk + cancellation.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void expirecycle(eosio::name coopname,
                                      checksum256 batch_hash,
                                      std::vector<checksum256> order_hashes,
                                      bool threshold_reached);

  /**
   * @brief Поставщик акцептует консолидированную заявку (Story 4.5).
   * Без ledger2-операций — только статус-переход active → accepted.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void acceptbatch(eosio::name coopname,
                                      eosio::name offerer,
                                      checksum256 batch_hash,
                                      std::vector<checksum256> order_hashes);

  /**
   * @brief Поставщик отказывается от заявки до акцепта (Story 4.5).
   * Для каждого order: o.mkt.unblk + cancellation.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void declinebatch(eosio::name coopname,
                                       eosio::name offerer,
                                       checksum256 batch_hash,
                                       std::vector<checksum256> order_hashes);

  /**
   * @brief Поставщик собирает партию к отгрузке (Story 5.1).
   * Жёсткий акцепт: состав ровно как акцептованный. Без ledger2-операций.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void prepship(eosio::name coopname,
                                   eosio::name offerer,
                                   checksum256 batch_hash,
                                   std::vector<checksum256> order_hashes,
                                   eosio::name shipping_method);

  /**
   * @brief Поставщик ставит первую подпись на АПП приёмки (Story 5.3/5.4).
   * Без ledger2-операций — только статус supply_prepared.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signsupp(eosio::name coopname,
                                   eosio::name offerer,
                                   checksum256 batch_hash,
                                   std::vector<checksum256> order_hashes,
                                   document2 act);

  /**
   * @brief Председатель ставит закрывающую подпись на АПП приёмки (Story 5.3/5.4).
   * Per-Order: o.mkt.purch + o.mkt.payout (атомарно в одной транзакции).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signchair(eosio::name coopname,
                                    eosio::name chairman,
                                    checksum256 batch_hash,
                                    std::vector<checksum256> order_hashes,
                                    document2 act);

  /**
   * @brief Председатель открывает выдачу первой подписью АПП-выдачи (Story 6.1).
   * Без ledger2-операций — только статус ready_to_receive.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signiss1(eosio::name coopname,
                                   eosio::name chairman,
                                   checksum256 order_hash,
                                   document2 act);

  /**
   * @brief Заказчик ставит финальную подпись АПП-выдачи (Story 6.3).
   * Per-Order с поддержкой actual_quantity ≠ ordered (Story 6.2).
   * Atomic: [o.mkt.unblk на разницу если actual<ordered |
   *          o.wal.conv+o.mkt.assign+o.mkt.block на разницу если actual>ordered]
   *         + o.mkt.consum + o.mkt.consum2.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signiss2(eosio::name coopname,
                                   eosio::name orderer,
                                   checksum256 order_hash,
                                   uint64_t actual_quantity,
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
   * @brief Председатель удалённо одобряет очный визит (Story 7.2).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void aprretrem(eosio::name coopname,
                                    eosio::name chairman,
                                    checksum256 request_hash,
                                    document2 decision);

  /**
   * @brief Председатель удалённо отказывает (Story 7.2).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrem(eosio::name coopname,
                                    eosio::name chairman,
                                    checksum256 request_hash,
                                    std::string reason,
                                    document2 decision);

  /**
   * @brief Председатель принимает возврат на очном осмотре (Story 7.4).
   * Atomic: o.mkt.return + o.mkt.return2 (compensating forward).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void accretrn(eosio::name coopname,
                                   eosio::name chairman,
                                   checksum256 request_hash,
                                   document2 decision);

  /**
   * @brief Председатель отказывает на очном осмотре (Story 7.3).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrn(eosio::name coopname,
                                   eosio::name chairman,
                                   checksum256 request_hash,
                                   std::string reason,
                                   document2 decision);

  // ── p.mkt.wroff ──────────────────────────────────────────────────────

  /**
   * @brief Backend / админ выносит проект списания на повестку совета (Story 8.1).
   * Без ledger2-операций — только создание proposal.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void propwroff(eosio::name coopname,
                                    eosio::name proposed_by,
                                    checksum256 proposal_hash,
                                    std::vector<wroff_item> items);

  /**
   * @brief Совет исполняет списание (Story 8.3).
   * Per-item: o.mkt.wroff + o.mkt.wroff2 (атомарно в той же транзакции).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void execwroff(eosio::name coopname,
                                    eosio::name decided_by,
                                    checksum256 proposal_hash,
                                    document2 protocol);

  /**
   * @brief Совет отклоняет проект списания (Story 8.3).
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
