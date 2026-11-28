#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"

/**
 * \ingroup public_tables
 * \brief Роли сети: ведущий и операторы.
 *
 * Сеть различает четыре роли (утверждено 28.11.2026):
 *
 *  - **ведущий** — кооператив, который запустил цепь. Он ведёт сеть: назначает
 *    и снимает операторов, регистрирует кооперативы. Ведущий в сети один;
 *  - **оператор** — кооператив, которого ведущий назначил подключать другие
 *    кооперативы и обслуживать их. Операторов в сети может быть несколько,
 *    ведущий назначает и себя;
 *  - **кооператив** — подключён к оператору (поле `parent_username` его записи
 *    в `coops`) либо работает на своей платформе (поле пусто);
 *  - **провайдер** — внешний сервис каталога приложений, облачного хостинга и
 *    подписок. В цепи у него роли нет: провайдера подключает узел.
 *
 * Цепочка доверия подписей (контракт `ano`) — отдельная, межсистемная: роли
 * сети от заверений АНО не зависят.
 *
 * Раньше ведущий был константой `_provider`, вкомпилированной в контракты, и
 * назывался «провайдером», хотя провайдер — другая сторона. Сеть со своим
 * ведущим требовала пересборки контрактов. Теперь ведущего хранит строка
 * `network`, а константа осталась значением по умолчанию: цепь без строки
 * ведёт себя как прежде.
 */

namespace Registrator {

using namespace eosio;

/// Состояние сети: кто её ведущий. Одна строка на цепь.
struct [[eosio::table, eosio::contract(REGISTRATOR)]] network_state {
  name lead;  ///< ведущий сети
};

typedef eosio::singleton<"network"_n, network_state> network_singleton;

/// Оператор сети: кооператив, которому ведущий доверил подключать кооперативы.
struct [[eosio::table, eosio::contract(REGISTRATOR)]] network_operator {
  name username;                ///< кооператив-оператор — первичный ключ
  time_point_sec appointed_at;  ///< когда ведущий назначил оператора

  uint64_t primary_key() const { return username.value; }
};

typedef eosio::multi_index<"operators"_n, network_operator> operators_index;

} // namespace Registrator

// Роли сети — служебный реестр: платит контракт.
RAM_PAYER_CLASS(Registrator::network_state, contract);
RAM_PAYER_CLASS(Registrator::network_operator, contract);

/**
 * @brief Ведущий сети.
 *
 * Читает строку `network` реестра. Строки нет — ведущий по умолчанию
 * (`_default_lead`): так цепь, запущенная до появления таблицы, работает без
 * миграции и при любом порядке выкатки контрактов.
 */
inline eosio::name network_lead() {
  Registrator::network_singleton state(_registrator, _registrator.value);
  return state.exists() ? state.get().lead : _default_lead;
}

/// Кооператив назначен оператором сети.
inline bool is_network_operator(eosio::name username) {
  Registrator::operators_index operators(_registrator, _registrator.value);
  return operators.find(username.value) != operators.end();
}
