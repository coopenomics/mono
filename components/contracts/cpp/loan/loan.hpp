#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "../lib/index.hpp"

/**
\defgroup public_loan Контракт LOAN

* Смарт-контракт управления займами кооператива предназначен для создания и погашения долговых обязательств участников.
*/

/**
\defgroup public_loan_processes Процессы
\ingroup public_loan
*/

/**
\defgroup public_loan_actions Действия
\ingroup public_loan
*/

/**
\defgroup public_loan_tables Таблицы
\ingroup public_loan
*/

/**
\defgroup public_loan_consts Константы
\ingroup public_loan
*/

/**
 *  \ingroup public_contracts
 *  @brief  Контракт Loan
 */
class [[eosio::contract]] loan : public coop_contract {
public:
    using coop_contract::coop_contract;

    [[eosio::action]] void migrate();

    //создать долг
    [[eosio::action]] void createdebt(CREATEDEBT_SIGNATURE);

    //погасить долг
    [[eosio::action]] void settledebt(SETTLEDEBT_SIGNATURE);
};
