#pragma once

#include <eosio/action.hpp>
#include <eosio/contract.hpp>
#include <eosio/eosio.hpp>
#include <eosio/system.hpp>
#include <tuple>

#include "ram_watch.hpp"

/**
 * @brief Базовый класс контрактов платформы.
 *
 * Служебные записи контракта (реестры, счётчики, договоры участия) оплачивает
 * сам контракт, и его квота памяти со временем подходит к концу. Пополнять её
 * руками по каждому контракту — значит однажды забыть, поэтому контракт просит
 * проверку сам (C28-78).
 *
 * Проверка стоит в конструкторе: класс контракта создаётся на каждое действие,
 * и одна строка здесь охватывает все действия всех контрактов без правки
 * самих действий. Сам контракт свою квоту узнать не может — вызовы квоты узел
 * разрешает только привилегированным контрактам, — поэтому он лишь читает у
 * системного контракта время следующей проверки и, когда оно подошло, подаёт
 * заявку `eosio::ramreq`. Квоту сверяет и память выдаёт системный контракт.
 *
 * Заявка уходит inline-действием и выполняется в той же транзакции. Квоту
 * памяти узел сверяет в самом конце транзакции, после всех inline-действий, так
 * что выданная память успевает и для действия, в котором заявка подана.
 *
 * Чтение строки расписания — одно обращение к таблице без записи; заявка
 * подаётся не чаще интервала проверки из настройки системного контракта.
 */
class coop_contract : public eosio::contract {
 public:
  coop_contract(eosio::name receiver, eosio::name code, eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {
    request_ram_check_if_due(receiver);
  }

 private:
  static void request_ram_check_if_due(eosio::name self) {
    const eosio::name system_account("eosio");

    ram_watch_table watch(system_account, system_account.value);
    auto itr = watch.find(self.value);
    if (itr != watch.end() && itr->next_check > eosio::current_time_point())
      return;

    eosio::action(eosio::permission_level{self, eosio::name("active")}, system_account, eosio::name("ramreq"),
                  std::make_tuple(self))
        .send();
  }
};
