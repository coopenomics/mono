#include "branch.hpp"

#include "src/accrue.cpp"
#include "src/addtrusted.cpp"
#include "src/aidconfirm.cpp"
#include "src/aiddecline.cpp"
#include "src/convert.cpp"
#include "src/createaid.cpp"
#include "src/createbranch.cpp"
#include "src/createspend.cpp"
#include "src/deletebranch.cpp"
#include "src/deltrusted.cpp"
#include "src/delweight.cpp"
#include "src/distribute.cpp"
#include "src/editbranch.cpp"
#include "src/setweight.cpp"
#include "src/spendconfirm.cpp"
#include "src/spenddecline.cpp"

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

