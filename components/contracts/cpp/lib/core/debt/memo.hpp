#pragma once

#include <eosio/eosio.hpp>
#include <string>

#include "../utils.hpp"

/**
 * @file memo.hpp
 * @brief Человекочитаемые memo операций ledger2 по беспроцентным займам.
 *
 * Текст попадает в журнал ledger2 и в выписку пайщика: без технических имён
 * операций и процессов. Номер договора займа — короткий хэш займа.
 */
namespace Debt::Memo {

  inline std::string contract_number(const eosio::checksum256& debt_hash) {
    return checksum256_to_hex(debt_hash).substr(0, 8);
  }

  inline std::string get_pledge_memo(const eosio::checksum256& debt_hash) {
    return "Обеспечение беспроцентного займа по договору № " + contract_number(debt_hash);
  }

  inline std::string get_unpledge_memo(const eosio::checksum256& debt_hash) {
    return "Возврат обеспечения беспроцентного займа по договору № " + contract_number(debt_hash);
  }

  inline std::string get_accrue_memo(const eosio::checksum256& debt_hash) {
    return "Беспроцентный заём к выдаче по договору № " + contract_number(debt_hash);
  }

  inline std::string get_lend_memo(const eosio::checksum256& debt_hash) {
    return "Выдача беспроцентного займа по договору № " + contract_number(debt_hash);
  }

  inline std::string get_cancel_memo(const eosio::checksum256& debt_hash) {
    return "Отмена выдачи беспроцентного займа по договору № " + contract_number(debt_hash);
  }

  inline std::string get_repay_memo(const eosio::checksum256& debt_hash) {
    return "Возврат беспроцентного займа по договору № " + contract_number(debt_hash) + " с главного кошелька";
  }

  inline std::string get_close_memo(const eosio::checksum256& debt_hash) {
    return "Закрытие беспроцентного займа по договору № " + contract_number(debt_hash);
  }

  inline std::string get_seize_memo(const eosio::checksum256& debt_hash) {
    return "Обращение обеспечения беспроцентного займа по договору № " + contract_number(debt_hash) + " в пользу кооператива";
  }

} // namespace Debt::Memo
