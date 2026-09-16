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

