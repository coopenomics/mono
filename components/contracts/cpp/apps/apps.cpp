#include "apps.hpp"
#include <eosio/transaction.hpp>

#include "src/regpackage.cpp"
#include "src/transferpkg.cpp"
#include "src/setrelease.cpp"
#include "src/reactivate.cpp"
#include "src/withdraw.cpp"
#include "src/cleanup.cpp"
#include "src/regsub.cpp"
#include "src/expsub.cpp"
#include "src/regcoop.cpp"
#include "src/setcoop.cpp"

/**
 * \brief Миграция контракта.
 * \details Пустышка для CDT-апгрейдов. Реальные миграции состояния
 *          выполняются через `eosio.msig`-предложение с конкретным
 *          планом (drop таблиц, переезд данных).
 * \note Авторизация: @ apps @ active.
 */
[[eosio::action]] void apps::migrate() {
  require_auth(_apps);
}
