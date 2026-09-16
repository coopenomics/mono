#include "ano.hpp"

#include "src/endorse.cpp"
#include "src/revoke.cpp"
#include "src/pubrepschema.cpp"

/**
 * \brief Миграция контракта.
 * \ingroup public_ano_actions
 * \details Пустышка для обновлений сборки. Настоящие миграции состояния
 *          выполняются отдельным планом.
 * \note Авторизация: @ ano @ active.
 */
[[eosio::action]] void ano::migrate() {
  require_auth(_ano);
}
