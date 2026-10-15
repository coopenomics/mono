#include "fund.hpp"

#include <ctime>
#include <eosio/transaction.hpp>

#include "src/addaccum.cpp"
#include "src/addcirculate.cpp"
#include "src/addexpense.cpp"
#include "src/accumfee.cpp"
#include "src/addinitial.cpp"
#include "src/authorize.cpp"
#include "src/delfund.cpp"
#include "src/complete.cpp"
#include "src/createfund.cpp"
#include "src/editfund.cpp"
#include "src/fundwithdraw.cpp"
#include "src/init.cpp"
#include "src/spreadamount.cpp"
#include "src/subaccum.cpp"
#include "src/subcirculate.cpp"
#include "src/subinitial.cpp"


using namespace eosio;

/**
 * @brief Миграция контракта управления фондами.
 * Выполняет миграцию контракта на новую версию.
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p _fund
 */
[[eosio::action]] void fund::migrate() {
  require_auth(_fund);
}

/**
 * @brief Регистрация нового фонда в системе.
 * Создает новый идентификатор для фонда в указанном кооперативе.
 * @param coopname Наименование кооператива
 * @param type Тип фонда (accumulation или expend)
 * @param id Идентификатор фонда
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p _fund
 */
[[eosio::action]] void fund::newfund(eosio::name coopname, eosio::name type,
                                     uint64_t id) {
  require_auth(_fund);
};

/**
 * @brief Регистрация нового запроса на вывод средств.
 * Создает новый идентификатор для запроса на вывод средств.
 * @param coopname Наименование кооператива
 * @param type Тип запроса
 * @param id Идентификатор запроса
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p _fund
 */
[[eosio::action]] void fund::newwithdraw(eosio::name coopname, eosio::name type,
                                         uint64_t id) {
  require_auth(_fund);
};

/**
 * @brief Очистка отработавших записей фондов (lib/core/cleanup.hpp).
 *
 * Правило: завершённый вывод из фонда после срока хранения (`expired_at`,
 * месяц от завершения). Решение совета по нему уже исполнено и удалено, а
 * повторно провести завершённый вывод контракт не должен.
 *
 * @note Авторизация требуется от аккаунта: @p fund
 */
void fund::cleanup() {
  require_auth(_fund);
  Cleanup::budget budget;
  const eosio::time_point_sec now(eosio::current_time_point());

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    fundwithdraws_index withdraws(_fund, coopname.value);
    Cleanup::erase_where(withdraws, budget, [&](const auto &withdraw) {
      return withdraw.status == "completed"_n && withdraw.expired_at <= now;
    });
  }

  Cleanup::report(_fund, budget);
}
