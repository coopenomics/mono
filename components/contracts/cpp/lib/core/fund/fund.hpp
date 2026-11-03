#pragma once

#include <string>
#include <tuple>

#include <eosio/action.hpp>
#include <eosio/asset.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>

#include "../../consts.hpp"

/**
 * Фонды накопления кооператива: хелперы для контрактов-источников членских
 * взносов (задача 99D-19, КЭУ-1; решение владельца 02.11.2026).
 *
 * Остатки фондов накопления ведутся в ledger2 на кошельке `w.fnd.accum` с
 * разрезом по имени фонда. Три стандартных фонда имеют постоянные имена
 * (`indivisible`, `reserve`, `develop`), дополнительные фонды совета получают
 * имя из идентификатора. Контракт-источник (сегодня — marketplace при
 * списании обеспечительной части) зовёт `fund::accrue` инлайн, деление по
 * процентам фондов делает сам контракт fund.
 */
namespace Fund {

/**
 * @brief Имя разреза кошелька `w.fnd.accum` для фонда без постоянного имени.
 *
 * `eosio::name` допускает только символы `.12345a-z`, поэтому десятичный
 * идентификатор в имя не годится: цифры 0 и 6–9 запрещены. Идентификатор
 * кодируется буквами по основанию 26 (`a`…`z`) после префикса `fnd`:
 * 0 → `fnda`, 25 → `fndz`, 26 → `fndba`. Префикс отличает фонды совета от
 * стандартных и от любых других разрезов.
 */
inline eosio::name wallet_name_for_id(uint64_t id) {
  std::string digits;
  do {
    digits.insert(digits.begin(), static_cast<char>('a' + id % 26));
    id /= 26;
  } while (id > 0);
  const std::string value = "fnd" + digits;
  // 12 символов — предел eosio::name без 13-го усечённого символа.
  eosio::check(value.size() <= 12,
               "FUND_WALLET_NAME_INVALID: Имя разреза кошелька фонда длиннее двенадцати символов");
  return eosio::name(value);
}

/**
 * @brief Имя разреза кошелька фонда: постоянное из строки либо построенное из
 * идентификатора — для строк, заведённых до появления поля `wallet_name`.
 */
inline eosio::name wallet_name_of(const accfund &fund) {
  if (fund.wallet_name.has_value() && fund.wallet_name.value().value != 0) {
    return fund.wallet_name.value();
  }
  // Кооперативы, заведённые до появления поля: три стандартных фонда узнаются
  // по названию из `fund::init` и получают те же постоянные имена, что и у
  // новых кооперативов; остальные — имя из идентификатора.
  if (fund.name == "Неделимый фонд") return "indivisible"_n;
  if (fund.name == "Резервный фонд") return "reserve"_n;
  if (fund.name == "Фонд развития кооперации") return "develop"_n;
  return wallet_name_for_id(fund.id);
}

/**
 * @brief Inline-вызов `fund::accrue` от контракта-источника членских взносов:
 * сумма делится между фондами накопления по их процентам и зачисляется на
 * `w.fnd.accum` по каждому фонду (`o.fnd.accrue`, Дт 80 / Кт 86) в нитке
 * процесса источника. Образец — `Branch::accrue`.
 */
inline void accrue(eosio::name actor, eosio::name coopname, eosio::asset amount,
                   eosio::name process_type, eosio::checksum256 process_hash,
                   std::string memo) {
  eosio::action(
    eosio::permission_level{actor, "active"_n},
    _fund,
    "accrue"_n,
    std::make_tuple(coopname, actor, amount, process_type, process_hash, memo)
  ).send();
}

} // namespace Fund
