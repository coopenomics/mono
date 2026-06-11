#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include "../lib/index.hpp"

/**
\defgroup public_billing Контракт BILLING

* Минимальный смарт-контракт оплаты инфраструктурных подписок членскими взносами
* пайщика (Epic 12 → расширен Epic 13 v5.1).
*
* Действия:
*   - `convert`    — трансляция паевого взноса пайщика в членский на биллинг-кошелёк
*                    кооператива (`w.wal.bill`, COOPERATIVE scope=coopname-пайщик)
*                    по подписанному заявлению (document2);
*   - `pay`        — списание с биллинг-кошелька суммарной стоимости time-подписок
*                    в инфраструктурный кошелёк кооператива (`w.sov.infra`) по
*                    идентификатору платежа (`payment_hash`). Авторизует оператор
*                    платформы (`_provider`), повтор `payment_hash` отклоняется
*                    on-chain (таблица `payments`);
*   - `converttoaxn` (Epic 13 v5.1) — бездокументарная конвертация членского
*                    взноса в AXON: BURN с `w.wal.bill[coopname]` + инъекция
*                    AXON (10₽=1AXON). Авторизация — `coopname@active` (без
*                    оператора-релея); runaway-guards — на стороне PowerupPlugin.
*
* Состав, цены и даты подписок on-chain НЕ хранятся — это зона оператора
* (provider backend); контракт несёт только сумму + `payment_hash` + memo.
*
* Anti-replay: контракт ведёт реестр проведённых `payment_hash` (`payments`).
* Это НЕ исторический архив, а рабочее состояние: каждая будущая транзакция
* `pay`/`converttoaxn` читает его, чтобы отклонить повторное списание тех же
* средств (оракул-инициатор мог не получить подтверждение и повторить вызов —
* зависший парсер, упавший backend между transact и callback провайдеру).
* RAM ограничен скользящим окном: записи старше TTL подчищаются при каждой
* новой записи (детерминированный gc небольшими порциями).
*
* Epic 13 архитектура: `w.wal.bill` — COOPERATIVE scope=coopname-пайщик, что
* совпадает с ключом PowerUp `coopname@active`, от имени которого работает
* PowerupPlugin. До Epic 13 кошелёк был USER_SHARED (L3 по username), что
* противоречило источнику авторизации пакетного исполнителя — перенесён в
* COOPERATIVE в `lib/core/ledger2/wallets.hpp`.
*/

/**
\defgroup public_billing_actions Действия
\ingroup public_billing
*/

/**
\defgroup public_billing_tables Таблицы
\ingroup public_billing
*/

namespace Billing {

/// TTL записи anti-replay реестра: после этого срока повтор payment_hash всё
/// равно невозможен по смыслу (provider давно закрыл invoice), запись подчищается.
inline constexpr uint32_t PAID_PAYMENT_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 дней
/// Максимум подчищаемых записей за одну транзакцию — ограничение CPU.
inline constexpr uint8_t PAID_PAYMENT_GC_BATCH = 8;

/**
 * @brief Реестр проведённых платежей (anti-replay, \ref public_billing_tables).
 *
 * scope: `_billing` (глобальный). Запись добавляется на каждый успешный
 * `pay`/`converttoaxn`; повторная транзакция с тем же `payment_hash`
 * отклоняется assert'ом. Защищает средства пайщиков от двойного списания,
 * когда инициатор-оракул (coopback Восхода / PowerupPlugin) не получил
 * подтверждение и повторил вызов.
 */
struct [[eosio::table, eosio::contract("billing")]] payment {
  uint64_t id;                        ///< Авто-инкрементный первичный ключ.
  eosio::checksum256 payment_hash;    ///< Идентификатор платежа из БД провайдера.
  eosio::time_point_sec paid_at;      ///< Момент проведения (для gc по TTL).

  uint64_t primary_key() const { return id; }
  eosio::checksum256 by_hash() const { return payment_hash; }
  uint64_t by_paid_at() const { return uint64_t(paid_at.sec_since_epoch()); }
};

typedef eosio::multi_index<
    "payments"_n, payment,
    eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<payment, eosio::checksum256, &payment::by_hash>>,
    eosio::indexed_by<"bypaidat"_n, eosio::const_mem_fun<payment, uint64_t, &payment::by_paid_at>>>
    payments_index;

/**
 * @brief Anti-replay: отклонить повтор `payment_hash` и зарегистрировать новый.
 *
 * Заодно подчищает скользящее окно — до \ref PAID_PAYMENT_GC_BATCH записей
 * старше \ref PAID_PAYMENT_TTL_SECONDS, чтобы реестр не рос бесконечно.
 */
inline void assert_first_payment_and_register(eosio::name payer_of_ram,
                                              eosio::checksum256 payment_hash) {
  payments_index payments(_billing, _billing.value);

  auto by_hash = payments.get_index<"byhash"_n>();
  eosio::check(by_hash.find(payment_hash) == by_hash.end(),
               "Платёж с этим payment_hash уже проведён (anti-replay)");

  const auto now = eosio::time_point_sec(eosio::current_time_point());

  payments.emplace(payer_of_ram, [&](auto &row) {
    row.id = payments.available_primary_key();
    row.payment_hash = payment_hash;
    row.paid_at = now;
  });

  // gc скользящего окна: удаляем самые старые записи, вышедшие за TTL.
  auto by_paid_at = payments.get_index<"bypaidat"_n>();
  uint8_t removed = 0;
  auto it = by_paid_at.begin();
  while (it != by_paid_at.end() && removed < PAID_PAYMENT_GC_BATCH &&
         it->paid_at.sec_since_epoch() + PAID_PAYMENT_TTL_SECONDS < now.sec_since_epoch()) {
    it = by_paid_at.erase(it);
    ++removed;
  }
}

/**
 * @brief Проверка, что аккаунт-плательщик является кооперативом (presence-only).
 *
 * По требованию @ant (2026-05-25): проверяем только НАЛИЧИЕ записи в реестре
 * кооперативов регистратора и флаг `is_cooperative`, БЕЗ проверки статуса —
 * заблокированные/на рассмотрении кооперативы тоже проходят этот guard
 * (статус контролируется выше по потоку, на стороне оператора/ledger2).
 */
inline void assert_payer_is_cooperative(eosio::name coopname) {
  cooperatives2_index coops(_registrator, _registrator.value);
  auto org = coops.find(coopname.value);
  eosio::check(org != coops.end(), "Плательщик не найден в реестре кооперативов");
  eosio::check(org->is_coop(), "Плательщик не является кооперативом");
}
} // namespace Billing

/**
 *  \ingroup public_contracts
 *  @brief Контракт Billing (оплата подписок членскими взносами).
 */
class [[eosio::contract]] billing : public contract {
public:
  using contract::contract;

  [[eosio::action]] void migrate();

  // Конвертация паевого взноса в членский на биллинг-кошелёк пайщика.
  // convert_hash — детерминированный sha256 от (coopname, username, amount,
  // anchor) — служит process-якорем: используется как ключ операции ledger2
  // и как package_hash для Soviet::make_complete_document (документ в реестре
  // ищется именно по convert_hash). Повтор с тем же convert_hash —
  // идемпотентный no-op на уровне реестра soviet (newresolved уже зафиксирован).
  [[eosio::action]] void convert(eosio::name coopname, eosio::name username,
                                 eosio::asset amount, eosio::checksum256 convert_hash,
                                 document2 document);

  // Списание с биллинг-кошелька стоимости подписок (оплата провайдеру).
  // Авторизация — _provider (оператор платформы): он ведёт учёт подписок и
  // инициирует рекуррентные списания. Повтор payment_hash отклоняется
  // on-chain (Billing::assert_first_payment_and_register).
  [[eosio::action]] void pay(eosio::name coopname, eosio::name username,
                             eosio::asset amount, eosio::checksum256 payment_hash,
                             std::string memo);

  // Epic 13 v5.1 — бездокументарная конвертация членского взноса в AXON.
  // Списывает amount членского с биллинг-кошелька кооператива (COOPERATIVE,
  // scope=coopname) как расход на инфраструктуру (operations::billing::CONVERT_TO_AXON,
  // WalletOp::BURN) и эмитирует кооперативу AXON по курсу 10₽=1AXON через
  // eosio::injection. Второй шаг двухшаговой модели (после billing::convert).
  // Авторизация — coopname@active (PowerupPlugin coopback'а пайщика подписывает сам,
  // без relay через оператора). Повтор payment_hash отклоняется on-chain
  // (anti-replay), учётная идемпотентность invoice/Payment — у provider'а.
  [[eosio::action]] void converttoaxn(eosio::name coopname, eosio::asset amount,
                                      eosio::checksum256 payment_hash);
};
