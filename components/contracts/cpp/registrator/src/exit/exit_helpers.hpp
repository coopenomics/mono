#pragma once

#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../../../lib/index.hpp"

/**
 * @brief Вспомогательные функции процедуры выхода пайщика из кооператива.
 *
 * Вынесены в отдельный заголовок (а не в table_registrator_exits.hpp), т.к.
 * опираются на ledger2-кошельки и userwallets, которые подключаются позже в
 * domain/index.hpp. Подключается в registrator.cpp перед exit-экшенами, когда
 * весь lib/index.hpp уже доступен.
 */
namespace Registrator {

using namespace eosio;

/**
 * @brief Доступный L3-баланс пайщика на USER_SHARED-кошельке ledger2.
 *
 * Возвращает available (без blocked) пары `(wallet_name, username)` из таблицы
 * userwallets контракта ledger2. Если записи нет — нулевая сумма в базовой
 * валюте управления.
 */
inline asset get_user_wallet_available(name coopname, name wallet_name, name username) {
  userwallets_index userwallets(_ledger2, coopname.value);
  auto idx = userwallets.get_index<"byuserwallet"_n>();
  auto it = idx.find(combine_ids(wallet_name.value, username.value));
  if (it == idx.end()) {
    return asset(0, _root_govern_symbol);
  }
  return it->available;
}

/**
 * @brief Консолидация доступного паевого кошелька пайщика на главный
 * (`w.wal.share`) перед резервом возврата при выходе.
 *
 * Главный кошелёк (`w.wal.share`) уже целевой — перенос не нужен. Для остальных
 * кошельков сета `LEDGER2_EXIT_REFUND_WALLETS` применяется операция переноса на
 * главный:
 *   w.reg.minshr → o.reg.mvmin  (MOVE_MINSHARE);
 *   w.cap.blago  → o.cap.wthcap (WITHDRAW_FROM_CAPITAL).
 *
 * Кошелёк сета без операции переноса (новый паевой кошелёк забыли смаппить)
 * валит транзакцию с явным сообщением — защита от тихой потери средств.
 */
inline void consolidate_share_to_main(name coopname, name username, name wallet_name, asset amount, checksum256 exit_hash) {
  if (wallet_name == ledger2_wallets::SHARE_FUND_PAY) return; // уже на главном паевом

  eosio::name op;
  if (wallet_name == ledger2_wallets::MIN_SHARE_FUND) {
    op = operations::registrator::MOVE_MINSHARE;       // w.reg.minshr → w.wal.share
  } else if (wallet_name == ledger2_wallets::BLAGOROST_FUND) {
    op = operations::capital::WITHDRAW_FROM_CAPITAL;   // w.cap.blago  → w.wal.share
  } else if (wallet_name == ledger2_wallets::MARKETPLACE_SHARE_FUND) {
    op = operations::marketplace::RECALL_SHARE;        // w.mkt.share  → w.wal.share
  } else {
    eosio::check(false,
      std::string{"Нет операции консолидации паевого кошелька "} + wallet_name.to_string() +
      " на главный при выходе — добавьте маппинг в consolidate_share_to_main");
  }

  // Нитку называет её инициатор — выход из кооператива, поэтому имя одно на
  // все консолидируемые кошельки. Иначе у одного exit_hash оказалось бы два
  // имени (p.wal.wthdrw и p.cap.wthcap), и какое победит, зависело бы от того,
  // на каком кошельке у пайщика ненулевой остаток. Операция возврата из
  // «Благороста» при этом остаётся собственной операцией — в чужой нитке она
  // идёт по тому же правилу, что членский взнос КУ внутри поставки.
  std::string memo = "Консолидация паевого взноса при выходе, кошелёк=" +
                     wallet_name.to_string() + ", username=" + username.to_string();
  Ledger2::apply(_registrator, coopname, op, processes::wallet::WITHDRAW,
                 amount, username, exit_hash, memo);
}

/**
 * @brief Выход запрещён, пока у пайщика есть паевой резерв под заказы Стола
 * заказов (w.mkt.order): он вернётся только выдачей или отменой заказа, а
 * автоматическая отмена при выходе тихо удержала бы половину после акцепта
 * поставщиком (решение владельца 10.09.2026, задача 99D-15).
 */
inline void check_no_marketplace_reserve(name coopname, name username) {
  const asset reserve = get_user_wallet_available(coopname, ledger2_wallets::MARKETPLACE_ORDER_LOCK, username);
  eosio::check(reserve.amount == 0,
    std::string{"Выход из кооператива невозможен: под заказы Стола заказов зарезервировано "} +
      reserve.to_string() + " — завершите или отмените заказы");
}

/**
 * @brief Выход запрещён, пока у пайщика открыта заявка на гарантийный возврат
 * в Столе заказов: решение совета по ней восстановит паевой и членский взнос,
 * и после выхода они легли бы на заблокированный аккаунт (решение владельца
 * 10.09.2026, задача 99D-16). Гарантийное окно выданных заказов выход не держит.
 */
inline void check_no_open_marketplace_returns(name coopname, name username) {
  Marketplace::return_requests_index requests(_marketplace, coopname.value);
  auto by_orderer = requests.get_index<"byorderer"_n>();
  eosio::check(by_orderer.find(username.value) == by_orderer.end(),
    "Выход из кооператива невозможен: открыто заявление на гарантийный возврат в Столе заказов — дождитесь его рассмотрения");
}

/**
 * @brief Остаток членского кошелька программы Стола заказов (w.mkt.member)
 * при выходе уходит через пул взносов (o.mkt.exfee) в общий кошелёк участка
 * пайщика (o.brn.common): членский взнос не возвращается и в паевой не
 * транслируется. Нулевой остаток — операции нет.
 * Вызывается там, где выход состоялся (`completexit` и одобрение без
 * выплаты), а не при одобрении с выплатой: кассир может выплату отклонить, и
 * пайщик останется в кооперативе (задача 99D-16).
 */
inline void forfeit_marketplace_member_fund(name coopname, name username, checksum256 exit_hash) {
  const asset balance = get_user_wallet_available(coopname, ledger2_wallets::MARKETPLACE_MEMBER_FUND, username);
  if (balance.amount <= 0) return;
  std::string memo = "Остаток членского кошелька Стола заказов в пул взносов при выходе, username=" +
                     username.to_string();
  Ledger2::apply(_registrator, coopname, operations::marketplace::EXIT_FEE_TO_POOL,
                 processes::wallet::WITHDRAW, balance, username, exit_hash, memo);

  // Из пула — в общий кошелёк участка, к которому прикреплён пайщик (решение
  // владельца 10.09.2026, задача 99D-16). Прямой перевод с кошелька пайщика на
  // кошелёк участка невозможен (один username на операцию), поэтому транзит
  // через пул взносов. Пайщик без участка или участок удалён — остаток
  // остаётся в пуле, выход не падает. Запись пайщика ещё жива: удаление из
  // реестра совета уходит инлайном позже (finalize_member_exit).
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  if (participant == participants.end() || !participant->braname.has_value()) return;
  const name braname = participant->braname.value();
  if (braname == name{}) return;
  branch_index branches(_branch, coopname.value);
  if (branches.find(braname.value) == branches.end()) return;

  ::Branch::accrue(_registrator, coopname, braname, balance, processes::wallet::WITHDRAW, exit_hash,
                   "Остаток членского кошелька Стола заказов в общий кошелёк участка при выходе, username=" +
                     username.to_string());
}

/**
 * @brief Финализация выхода: удаление пайщика из реестра совета и блокировка
 * аккаунта в registrator.
 *
 * Вызывается по завершении возврата паевого взноса (completexit) либо сразу,
 * если возвращать нечего (нулевой паевой). После этого `get_participant_or_fail`
 * для пайщика начинает падать — он лишён права подавать заявления.
 */
inline void finalize_member_exit(name coopname, name username) {
  // удаляем пайщика из реестра совета (уменьшит счётчик активных пайщиков)
  action(
    permission_level{_registrator, "active"_n},
    _soviet,
    "delpartcpnt"_n,
    std::make_tuple(coopname, username)
  ).send();

  // блокируем аккаунт в картотеке registrator
  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);
  eosio::check(account != accounts.end(), "Аккаунт не найден");
  accounts.modify(account, _registrator, [&](auto &a) {
    a.status = "blocked"_n;
  });
}

} // namespace Registrator
