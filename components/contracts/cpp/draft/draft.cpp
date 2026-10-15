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

/**
 * @brief Очистка отработавших записей реестра шаблонов (lib/core/cleanup.hpp).
 *
 * Правило: перевод шаблона, которого уже нет в той же области. Удаление шаблона
 * переводы не трогало, а новый шаблон с тем же номером получил бы чужой перевод
 * рядом со своим.
 *
 * @note Авторизация требуется от аккаунта: @p draft
 */
void draft::cleanup() {
  require_auth(_draft);
  Cleanup::budget budget;

  std::vector<eosio::name> scopes = Core::Registrator::get_cooperative_names();
  scopes.push_back(_draft);

  for (const auto &scope : scopes) {
    if (budget.exhausted()) break;

    translations_index translations(_draft, scope.value);
    auto by_draft = translations.get_index<"bydraft"_n>();
    using by_draft_t = std::decay_t<decltype(by_draft)>;

    // Строки шаблонов и переводов весят килобайты: идём по различным draft_id
    // индекса, не разбирая строк, и поднимаем только переводы-сироты.
    uint64_t draft_id = 0;
    uint64_t from = 0;
    while (!budget.exhausted() && Cleanup::next_index_value<by_draft_t>(_draft, scope.value, from, draft_id)) {
      if (!Cleanup::row_exists(_draft, scope.value, "drafts"_n, draft_id)) {
        for (auto itr = by_draft.lower_bound(draft_id);
             itr != by_draft.end() && itr->draft_id == draft_id && !budget.exhausted();) {
          itr = by_draft.erase(itr);
          budget.take();
        }
      }
      if (draft_id == std::numeric_limits<uint64_t>::max()) break;
      from = draft_id + 1;
    }
  }

  Cleanup::report(_draft, budget);
}
