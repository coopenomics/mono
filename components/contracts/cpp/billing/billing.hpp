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
*   - `convert`    — трансляция паевого взноса пайщика в членский на его
*                    биллинг-кошелёк (`w.wal.bill[username]`, USER_SHARED в
*                    леджере оператора) по подписанному заявлению (document2);
*   - `pay`        — списание с биллинг-кошелька суммарной стоимости time-подписок
*                    в инфраструктурный кошелёк кооператива (`w.sov.infra`) по
*                    идентификатору платежа (`payment_hash`). Авторизует оператор
*                    платформы (`_provider`); дедуп повторов — журнал PG
*                    оператора (on-chain таблиц нет);
*   - `converttoaxn` (Epic 13 v5.1) — бездокументарная конвертация членского
*                    взноса в AXON: BURN с `w.wal.bill[coopname]` + инъекция
*                    AXON (10₽=1AXON). Авторизует оператор платформы
*                    (`_provider`): членские взносы — его леджер, спицы своими
*                    ключами управляют только полученным AXON. Квоту/cooldown
*                    enforce'ит провайдер при выписке package-invoice.
*
* Состав, цены и даты подписок on-chain НЕ хранятся — это зона оператора
* (provider backend); контракт несёт только сумму + `payment_hash` + memo.
*
* Контракт своих таблиц НЕ ведёт (RAM чейна конечна, платежи в ней не хранятся —
* решение @ant 2026-06-11). Защита от повторного списания (`payment_hash`) —
* журнал в PG coopback'а оператора: INSERT до transact, повтор блокируется
* локально (см. BillingPaymentLog в controller).
*
* Архитектура кошелька (решение @ant 2026-06-11): `w.wal.bill` — USER_SHARED
* в леджере кооператива-оператора (`_provider`). Для оператора каждый
* кооператив-пайщик — обычный username, его биллинг-баланс лежит на L3-разрезе.
* Пополнение (`convert`, релей оператора) и расход (`pay` и `converttoaxn`
* оператором `_provider`) работают с одним и тем же разрезом —
* COOPERATIVE-вариант Epic 13 не смыкал поток (пополнение шло в scope
* оператора, расход искал scope спицы).
*/

/**
\defgroup public_billing_actions Действия
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
  // Авторизация — _provider (оператор платформы): он ведёт учёт подписок и
  // инициирует рекуррентные списания. Дедуп повторов payment_hash — журнал
  // PG оператора (контракт таблиц не ведёт).
  [[eosio::action]] void pay(eosio::name coopname, eosio::name username,
                             eosio::asset amount, eosio::checksum256 payment_hash,
                             std::string memo);

  // Epic 13 v5.1 — бездокументарная конвертация членского взноса в AXON.
  // Списывает amount членского с биллинг-кошелька кооператива-пайщика
  // (w.wal.bill[coopname], USER_SHARED в леджере оператора _provider)
  // как расход на инфраструктуру (operations::billing::CONVERT_TO_AXON,
  // WalletOp::BURN) и эмитирует кооперативу AXON по курсу 10₽=1AXON через
  // eosio::injection. Второй шаг двухшаговой модели (после billing::convert).
  // Авторизация — _provider (оператор платформы): членские взносы — его леджер,
  // инициирует hub-cron Восхода по исчерпанию AXON у спицы. Идемпотентность по
  // payment_hash — журнал PG оператора; квота/cooldown — у provider'а
  // (контракт таблиц не ведёт).
  [[eosio::action]] void converttoaxn(eosio::name coopname, eosio::asset amount,
                                      eosio::checksum256 payment_hash);
};
