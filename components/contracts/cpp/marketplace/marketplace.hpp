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
 *  - **p.mkt.supply** (13 actions): createorder, stockorder, cancelorder,
 *    expireorder, acceptorder, declineorder, signsupp, signchair, signiss1,
 *    signiss2, closeorder, markdown, setfee.
 *  - **p.mkt.return** (5 actions): submretrn, aprretrem, rejretrem, accretrn,
 *    rejretrn.
 *  - **p.mkt.wroff** (4 actions): propwroff, execwroff, onmktwoauth, onmktwodecl.
 *    Cписание скоропорта идёт через канонический паттерн «решение совета»:
 *    backend подписывает Заявление о списании (registry 1106) ключом
 *    кооператива, вызывает `propwroff` (запись wroffprops::proposed) +
 *    `soviet::createagenda(type=mktwroff, callback=onmktwoauth/onmktwodecl)`.
 *    После голосования совета и подписи Протокола (registry 1105) chairman'ом
 *    soviet::exec автоматически вызывает callback `onmktwoauth` (PROPOSED →
 *    AUTHORIZED, сохраняется protocol2) или `onmktwodecl` (PROPOSED → REJECTED).
 *    Только после AUTHORIZED backend циклом по items вызывает `execwroff`
 *    per-item (o.mkt.wroff на каждой позиции).
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
   * Один шаг ledger2: o.mkt.lock (TRANSFER w.wal.share → w.mkt.order).
   * `convert_statement` — подписанное заказчиком заявление о конвертации
   * паевого взноса в членский по программе «Стол заказов»; публикуется в
   * реестр документов отдельным пакетом (package = hash заявления).
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
                                      uint32_t warranty_period_secs,
                                      checksum256 batch_hash,
                                      document2 convert_statement);

  /**
   * @brief Заказ из обезличенного остатка склада кооператива (requirement 76).
   * Продавец — сам кооператив (`offerer == coopname`), имущество уже на
   * счёте 10 после ранее закрытых приёмок, поэтому Order создаётся сразу в
   * `acceptcoop` и идёт только через выдачу signiss1/signiss2. Один шаг
   * ledger2: o.mkt.lock (TRANSFER w.wal.share → w.mkt.order). Этапы поставки
   * и выплата поставщику для такого заказа не существуют.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void stockorder(eosio::name coopname,
                                     eosio::name orderer,
                                     checksum256 order_hash,
                                     checksum256 offer_hash,
                                     eosio::name delivery_braname,
                                     uint64_t quantity,
                                     eosio::asset unit_price,
                                     uint32_t warranty_period_secs,
                                     checksum256 batch_hash,
                                     document2 convert_statement);

  /**
   * @brief Заказчик отменяет заказ до акцепта (Story 4.4). Триггерит o.mkt.unlock.
   * Заказ из остатка кооператива (offerer == coopname) отменяется и в
   * `acceptcoop` — до первой подписи акта выдачи (откат оператора,
   * requirement 76 решение 11).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void cancelorder(eosio::name coopname,
                                      eosio::name orderer,
                                      checksum256 order_hash);

  /**
   * @brief Backend закрывает Order по таймауту цикла отсечки (Story 4.3).
   * Per-Order: o.mkt.unlock + статус active → cancelled. Backend вычисляет
   * threshold по batch'у вне контракта; для каждого истёкшего Order'а
   * вызывается отдельный `expireorder`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void expireorder(eosio::name coopname,
                                      checksum256 order_hash);

  /**
   * @brief Закрыть выданный заказ после выхода гарантийного срока:
   * терминал жизненного цикла, запись стирается из RAM. Вызывается
   * автоматизированной службой по расписанию; до выхода гарантийного
   * срока, при незавершённой выплате поставщику или открытом возврате
   * закрытие отклоняется.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void closeorder(eosio::name coopname,
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
   * Per-Order: o.mkt.unlock на total_cost + статус active → cancelled.
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
                                    uint64_t actual_quantity,
                                    eosio::asset actual_unit_price,
                                    document2 act);

  /**
   * @brief Инициация исходящей выплаты поставщику через контракт gateway по
   * одному Order'у (E11 техдолг 598-16, Locked Decision L12). Per-Order:
   * inline-вызов `gateway::createoutpay` с callback'ами на `payconfirm` /
   * `paydecline`. Ledger2-операция o.mkt.payout (Дт 86 / Кт 51) применяется
   * НЕ здесь, а в callback'е `payconfirm` после действия кассира. Статус
   * Order'а не меняется; защита от двойного запроса — через
   * `order.payout_status` (NONE/DECLINED → PENDING).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void payout(eosio::name coopname,
                                 checksum256 order_hash);

  /**
   * @brief Callback от gateway::outcomplete — кассир подтвердил
   * банковский перевод поставщику (E11 техдолг 598-16, Locked Decision L12).
   * Здесь применяется o.mkt.payout (Дт 86 / Кт 51) и `payout_status`
   * переходит PENDING → COMPLETED. Авторизация: `_gateway`. `outcome_hash`
   * совпадает с `order.hash` (так задано при `payout`).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void payconfirm(eosio::name coopname,
                                     checksum256 outcome_hash);

  /**
   * @brief Callback от gateway::outdecline — кассир отметил, что
   * банковский перевод не состоялся (E11 техдолг 598-16, Locked Decision L12).
   * Ledger2-операция НЕ применяется; обязательство Кт 86 остаётся открытым.
   * `payout_status` PENDING → DECLINED; `payout_decline_reason` сохраняется.
   * Авторизация: `_gateway`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void paydecline(eosio::name coopname,
                                     checksum256 outcome_hash,
                                     std::string reason);

  /**
   * @brief Списание уценки по заказу из остатка кооператива (requirement 76).
   * Разница между стоимостью прибытия выданного и фактической суммой выдачи
   * выбывает со счёта 10 в прочие расходы: o.mkt.loss (NONE, Дт 91 / Кт 10).
   * Вместе с o.mkt.consum даёт выбытие по полной стоимости прибытия — на
   * складе ничего не зависает. Вызывает backend после финализации выдачи
   * (сумму считает по выданным позициям). Погашение накопленного на 91
   * (Дт 86 / Кт 91) — будущий процесс по образцу списания скоропорта.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void markdown(eosio::name coopname,
                                   checksum256 order_hash,
                                   eosio::asset amount);

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
   * Atomic: [o.mkt.unlock на разницу если actual<ordered |
   *          o.mkt.lock на разницу если actual>ordered]
   *         + o.mkt.consum.
   * Подпись акта: orderer + любой авторизованный из branches[o.delivery_braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void signiss2(eosio::name coopname,
                                   eosio::name orderer,
                                   checksum256 order_hash,
                                   uint64_t actual_quantity,
                                   eosio::asset actual_unit_price,
                                   eosio::name delivery_signer,
                                   document2 act);

  /**
   * @brief Установка единой ставки членского взноса «Стола заказов»
   * (requirement b6). Одна ставка на весь кооператив (HUNDR_PERCENTS = 100%);
   * задаёт администратор. Применяется к новым заказам; в созданных заказах
   * взнос зафиксирован полем Order.membership_fee.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void setfee(eosio::name coopname,
                                 uint64_t membership_fee_percent);

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
                                    checksum256 request_hash);

  /**
   * @brief Председатель удалённо отказывает (Story 7.2). Авторизация:
   * подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrem(eosio::name coopname,
                                    eosio::name signer,
                                    eosio::name braname,
                                    checksum256 request_hash,
                                    std::string reason);

  /**
   * @brief Председатель принимает возврат на очном осмотре (Story 7.4).
   * Один шаг: o.mkt.return (compensating forward к o.mkt.consum). Председатель
   * накладывает вторую подпись на заявление пайщика (`statement` несёт обе
   * подписи — пайщика и председателя), отдельного документа решения нет.
   * Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void accretrn(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash,
                                   document2 statement);

  /**
   * @brief Председатель отказывает на очном осмотре (Story 7.3).
   * Авторизация: подписант ∈ branches[braname].
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void rejretrn(eosio::name coopname,
                                   eosio::name signer,
                                   eosio::name braname,
                                   checksum256 request_hash,
                                   std::string reason);

  // ── p.mkt.wroff ──────────────────────────────────────────────────────

  /**
   * @brief Backend выносит проект списания на повестку совета (Story 8.1).
   * Без ledger2-операций — только создание proposal с N позициями (статус
   * proposed) и тем же inline-вызовом ставит повестку: `soviet::createagenda`
   * от `permission_level{_marketplace, active}` с `callback_contract=marketplace`,
   * `confirm_callback=onmktwoauth`, `decline_callback=onmktwodecl`,
   * `type=mktwroff`, `hash=proposal_hash`, `statement` (Заявление 1106).
   * Проект может подаваться председателем (за подписью) либо автоматически —
   * мост повестки целиком на контракте, без участия backend.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void propwroff(eosio::name coopname,
                                    eosio::name proposed_by,
                                    checksum256 proposal_hash,
                                    std::vector<wroff_item> items,
                                    document2 statement,
                                    std::string meta);

  /**
   * @brief Callback от `soviet::exec` после авторизации Протокола совета
   * (registry 1105) председателем (Story 8.4). PROPOSED → AUTHORIZED;
   * сохраняется `authorization` в `wroffprops.protocol`. Цикл per-item
   * списания запускает backend через `execwroff` после получения этой дельты.
   *
   * Авторизация: контракт `_soviet` (`require_auth(_soviet)`); сигнатура
   * соответствует `authorize_action_effect` в soviet — `(coopname, hash,
   * authorization)`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktwoauth(eosio::name coopname,
                                      checksum256 hash,
                                      document2 authorization);

  /**
   * @brief Callback от `soviet::cancelexprd` (или от любого decline-эффекта в
   * soviet) — повестка отклонена или просрочена (Story 8.4). PROPOSED →
   * REJECTED; `reason` сохраняется в `wroffprops.reject_reason`. Без
   * ledger2-движений.
   *
   * Сигнатура `(coopname, hash, reason)` соответствует
   * `DECLINE_CALLBACK_SIGNATURE` в `lib/core/soviet/soviet.hpp:19`.
   * Авторизация: `_soviet`.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void onmktwodecl(eosio::name coopname,
                                      checksum256 hash,
                                      std::string reason);

  /**
   * @brief Backend исполняет одну позицию авторизованного проекта списания
   * (Story 8.4). Per-item: `o.mkt.wroff`, `items[item_index].executed = true`.
   * Когда все items исполнены, статус AUTHORIZED → EXECUTED.
   *
   * Защита от газового лимита (тысячи позиций в одной транзакции Antelope
   * не помещаются) — backend проходит цикл и вызывает `execwroff` per item.
   *
   * Guards:
   *  - proposal.status == AUTHORIZED (callback `onmktwoauth` уже отработал);
   *  - подписант (`signer`) авторизован для КУ-источника
   *    (`branches[items[item_index].braname]`).
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void execwroff(eosio::name coopname,
                                    eosio::name signer,
                                    checksum256 proposal_hash,
                                    uint64_t item_index);

  // ── service ──────────────────────────────────────────────────────────

  /**
   * @brief Заглушка миграции — donor-таблиц нет, мигрировать нечего.
   * Оставлена для совместимости с CMake-build и прежним ABI.
   * @ingroup public_marketplace_actions
   */
  [[eosio::action]] void migrate();
};
