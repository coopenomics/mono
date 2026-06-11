#include "branch.hpp"

#include "src/addtrusted.cpp"
#include "src/createbranch.cpp"
#include "src/deletebranch.cpp"
#include "src/deltrusted.cpp"
#include "src/editbranch.cpp"
#include "src/createdec.cpp"
#include "src/joindec.cpp"
#include "src/setchair.cpp"
#include "src/startdec.cpp"
#include "src/votedec.cpp"
#include "src/closedec.cpp"

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

