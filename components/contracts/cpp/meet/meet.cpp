// meet.cpp
#include "meet.hpp"
#include "src/vote.cpp"
#include "src/createmeet.cpp"
#include "src/authmeet.cpp"
#include "src/declmeet.cpp"
#include "src/restartmeet.cpp"
#include "src/signbysecr.cpp"
#include "src/signbypresid.cpp"
#include "src/newgdecision.cpp"
#include "src/gmnotify.cpp"

#include <optional>

/**
 * @brief Миграция данных контракта.
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p meet
 */
[[eosio::action]]
void meet::migrate(){
  require_auth(_meet);
};

/**
 * @brief Удаление собрания.
 * Удаляет собрание из системы по его ID
 * @param coopname Наименование кооператива
 * @param meet_id ID собрания для удаления
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p meet
 */
[[eosio::action]]
void meet::delmeet(eosio::name coopname, uint64_t meet_id) {
  require_auth(_meet);
  
  Meet::meets_index genmeets(_meet, coopname.value);
  auto meet = genmeets.find(meet_id);
  
  eosio::check(genmeets.end() != meet, "Собрание не найдено");
  
  genmeets.erase(meet);
};

std::optional<Meet::meet> meet::get_meet(eosio::name coopname, const checksum256 &hash) {
    Meet::meets_index genmeets(_meet, coopname.value);
    auto hash_index = genmeets.get_index<"byhash"_n>();

    auto itr = hash_index.find(hash);
    if (itr == hash_index.end()) {
        return std::nullopt;
    }

    return *itr;
}

/**
 * @brief Очистка отработавших записей собраний (lib/core/cleanup.hpp).
 *
 * Правила:
 * - закрытое собрание (status == closed). Контракт стирает его сам в конце
 *   signbypresid; правило подметает закрытые прежней версией, которая строку
 *   оставляла. Итоги и протокол к этому моменту уже в событии newgdecision и в
 *   реестре документов совета, контроллер читает собрание из журнала дельт.
 * - вопрос повестки, чьего собрания уже нет. Вопросы удаляются при закрытии
 *   собрания, а отклонённое и удалённое собрание их оставляло.
 *
 * @note Авторизация требуется от аккаунта: @p meet
 */
void meet::cleanup() {
  require_auth(_meet);
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    Meet::meets_index meets(_meet, coopname.value);
    Cleanup::erase_where(meets, budget, [&](const auto &meet) {
      return meet.status == "closed"_n;
    });

    Meet::questions_index questions(_meet, coopname.value);
    Cleanup::erase_where(questions, budget, [&](const auto &question) {
      return meets.find(question.meet_id) == meets.end();
    });
  }

  Cleanup::report(_meet, budget);
}
