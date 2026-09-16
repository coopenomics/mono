#include "draft.hpp"
#include <ctime>
#include <eosio/transaction.hpp>
#include <eosio/crypto.hpp>

#include "src/createdraft.cpp"
#include "src/createtrans.cpp"
#include "src/deldraft.cpp"
#include "src/deltrans.cpp"
#include "src/editdraft.cpp"
#include "src/edittrans.cpp"
#include "src/upversion.cpp"
#include "src/approve.cpp"

using namespace eosio;

/**
 * @brief Миграция контракта шаблонов документов.
 * Выполняет миграцию контракта на новую версию.
 * @ingroup public_actions
 * @ingroup public_draft_actions

 * @note Авторизация требуется от аккаунта: @p _draft
 */
[[eosio::action]]
void draft::migrate() {
  require_auth(_draft);
}

/**
 * @brief Создание нового идентификатора в области видимости.
 * Создает новый идентификатор для использования в контракте.
 * @param scope Область видимости (кооператив или _draft)
 * @param id Идентификатор для создания
 * @ingroup public_actions
 * @ingroup public_draft_actions

 * @note Авторизация требуется от аккаунта: @p _draft
 */
void draft::newid(eosio::name scope, uint64_t id) { require_auth(_draft); };


