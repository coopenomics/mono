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
*                    идентификатору платежа (`payment_hash`), идемпотентно;
*   - `topup_axon` (Epic 13 v5.1) — документless докупка пакета PowerUp:
*                    bill[coopname] → axon[coopname] inline-TRANSFER'ом.
*                    Авторизация — `coopname@active` (без оператора-релея);
*                    runaway-guards задаются на стороне PowerupPlugin coopback'а.
*
* Состав, цены и даты подписок on-chain НЕ хранятся — это зона оператора
* (provider backend); контракт несёт только сумму + `payment_hash` + memo.
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
  [[eosio::action]] void pay(eosio::name coopname, eosio::name username,
                             eosio::asset amount, eosio::checksum256 payment_hash,
                             std::string memo);
};
