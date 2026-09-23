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

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правил нет: поручительства с истёкшим сроком остаются — без строки продлить поручительство сможет любой поручитель, а не исходный, и это решение не принято.
 *
 * @note Авторизация требуется от аккаунта контракта.
 */
void ano::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;
  Cleanup::report(get_self(), budget);
}
