#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "../lib/index.hpp"
#include "domain.hpp"

/**
\defgroup public_debt Контракт DEBT

* Единый реестр беспроцентных займов пайщикам. Контракт сам выдаёт займы под
* обеспечение паевым взносом по реестру обеспечения и ведёт записи о займах,
* выданных другими приложениями кооператива.
*/

/**
\defgroup public_debt_processes Процессы
\ingroup public_debt
*/

/**
\defgroup public_debt_actions Действия
\ingroup public_debt
*/

/**
\defgroup public_debt_tables Таблицы
\ingroup public_debt
*/

/**
\defgroup public_debt_consts Константы
\ingroup public_debt
*/

/**
 *  \ingroup public_contracts
 *  @brief  Контракт Debt
 */
class [[eosio::contract]] debt : public coop_contract {
public:
    using coop_contract::coop_contract;

    [[eosio::action]] void migrate();
    /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
    [[eosio::action]] void cleanup();

    // ── Заём под обеспечение паевым взносом (p.dbt.loan) ─────────────────
    /// Пайщик подаёт заявление и договор, обеспечение переводится на кошелёк обеспечения, заявление уходит в совет.
    [[eosio::action]] void createloan(eosio::name coopname, eosio::name username, eosio::name collateral,
                                      checksum256 debt_hash, eosio::asset amount, eosio::time_point_sec due_at,
                                      document2 statement, document2 contract);
    /// Совет разрешил выдачу: договор уходит председателю на подпись.
    [[eosio::action]] void loanauth(eosio::name coopname, checksum256 debt_hash, document2 decision);
    /// Совет отказал: обеспечение возвращается, запись удаляется.
    [[eosio::action]] void loandecl(eosio::name coopname, checksum256 debt_hash, std::string reason);
    /// Председатель подписал договор: сумма начислена к выдаче, платёж передан кассиру.
    [[eosio::action]] void loansigned(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                                      document2 signed_contract);
    /// Председатель отказался подписывать договор: обеспечение возвращается, запись удаляется.
    [[eosio::action]] void loansgndecl(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                                       std::string reason);
    /// Кассир выплатил: заём выдан, идёт срок возврата.
    [[eosio::action]] void loanpaid(eosio::name coopname, checksum256 debt_hash);
    /// Платёж не прошёл по реквизитам: решение в силе, заём ждёт повтора.
    [[eosio::action]] void loanpaydecl(eosio::name coopname, checksum256 debt_hash, std::string reason);
    /// Повторная отправка платежа тем же решением совета.
    [[eosio::action]] void retrypay(eosio::name coopname, checksum256 debt_hash);
    /// Отмена выдачи до выплаты.
    [[eosio::action]] void cancelloan(eosio::name coopname, checksum256 debt_hash, std::string reason);

    // ── Возврат и срок ────────────────────────────────────────────────────
    /// Возврат займа с главного кошелька пайщика по заявлению, целиком или частью.
    [[eosio::action]] void repayloan(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                                     eosio::asset amount, document2 statement);
    /// Заявление о продлении срока: уходит председателю на подтверждение.
    [[eosio::action]] void extendloan(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                                      eosio::time_point_sec new_due_at, document2 statement);
    /// Председатель подтвердил продление.
    [[eosio::action]] void loanextok(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                                     document2 approved_statement);
    /// Председатель отказал в продлении.
    [[eosio::action]] void loanextdecl(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                                       std::string reason);
    /// Сверка сроков: перевод в просрочку и обращение обеспечения после пяти дней просрочки, пачками.
    [[eosio::action]] void sweep(eosio::name coopname, uint32_t limit);

    // ── Займы других приложений ───────────────────────────────────────────
    /// Приложение зарегистрировало выданный им заём.
    [[eosio::action]] void regloan(REGLOAN_SIGNATURE);
    /// Приложение сообщило о погашении своего займа на сумму.
    [[eosio::action]] void settleloan(SETTLELOAN_SIGNATURE);
    /// Приложение закрыло свой заём без денег.
    [[eosio::action]] void wroffloan(WROFFLOAN_SIGNATURE);
};
