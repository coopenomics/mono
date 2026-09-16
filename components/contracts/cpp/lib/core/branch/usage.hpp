#pragma once

#include <string>

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

/**
 * Проверки участка, которые зависят от программ, работающих через участок
 * (shared-слой, задача 99D-16). Контракт branch зовёт один метод и чужих таблиц
 * не знает; какие программы держат участок, знает только этот файл. Подключается
 * из core/index.hpp после заголовков программ.
 */
namespace Branch {

/// Участок можно удалить: ни одна программа на нём не держится и в общем
/// кошельке участка ничего не осталось.
inline void check_can_delete(eosio::name coopname, eosio::name braname) {
  eosio::check(!Marketplace::has_orders_at_branch(coopname, braname),
               "Кооперативный участок нельзя удалить: на нём есть заказы Стола заказов — завершите или отмените их");

  const eosio::asset common = Ledger2::get_user_available(coopname, ledger2_wallets::BRANCH_COMMON, braname);
  eosio::check(common.amount == 0,
               "Кооперативный участок нельзя удалить: в общем кошельке участка остаток " +
                 common.to_string() + " — распределите или израсходуйте его");
}

} // namespace Branch
