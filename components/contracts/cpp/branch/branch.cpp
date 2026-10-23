#include "branch.hpp"

#include "src/accrue.cpp"
#include "src/addtrusted.cpp"
#include "src/aidconfirm.cpp"
#include "src/aiddecline.cpp"
#include "src/createaid.cpp"
#include "src/createbranch.cpp"
#include "src/deletebranch.cpp"
#include "src/deltrusted.cpp"
#include "src/delweight.cpp"
#include "src/distribute.cpp"
#include "src/editbranch.cpp"
#include "src/createexp.cpp"
#include "src/onexpdone.cpp"
#include "src/retfee.cpp"
#include "src/setweight.cpp"
#include "src/setprivate.cpp"
#include "src/addwhite.cpp"
#include "src/delwhite.cpp"
#include "src/createdec.cpp"
#include "src/joindec.cpp"
#include "src/startdec.cpp"
#include "src/votedec.cpp"
#include "src/closedec.cpp"
#include "src/exec.cpp"
#include "src/confirmdec.cpp"
#include "src/declinedec.cpp"
#include "src/canceldec.cpp"
#include "src/apprliab.cpp"
#include "src/declliab.cpp"
#include "src/apprauth.cpp"
#include "src/declauth.cpp"
#include "src/reqtrusted.cpp"
#include "src/apprtrusted.cpp"
#include "src/decltrusted.cpp"
#include "src/onaidauth.cpp"
#include "src/onaiddecl.cpp"

using namespace eosio;

/**
 * @brief Инициализация контракта кооперативных участков.
 * Выполняет начальную настройку контракта.
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p _branch
 */
[[eosio::action]] void branch::migrate() {
  require_auth(_branch);
}

/**
 * @brief Инициализация контракта кооперативных участков.
 * Выполняет начальную настройку контракта.
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p _system
 */
[[eosio::action]] void branch::init()
{
  require_auth(_system);  
};

/**
 * @brief Очистка отработавших записей кооперативных участков (lib/core/cleanup.hpp).
 *
 * Правило: заявки в доверенные и веса распределения участка, которого уже нет.
 * Удаление участка их не трогало; заявку по такому участку не одобрить, а веса
 * ожили бы при создании участка с тем же именем.
 *
 * @note Авторизация требуется от аккаунта: @p branch
 */
void branch::cleanup() {
  require_auth(_branch);
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    branch_index branches(_branch, coopname.value);
    auto branch_gone = [&](eosio::name braname) { return branches.find(braname.value) == branches.end(); };

    trustreq_index trustreqs(_branch, coopname.value);
    Cleanup::erase_where(trustreqs, budget, [&](const auto &request) { return branch_gone(request.braname); });

    branch_weights_index weights(_branch, coopname.value);
    Cleanup::erase_where(weights, budget, [&](const auto &weight) { return branch_gone(weight.braname); });

    branch_weight_totals_index totals(_branch, coopname.value);
    Cleanup::erase_where(totals, budget, [&](const auto &total) { return branch_gone(total.braname); });
  }

  Cleanup::report(_branch, budget);
}
