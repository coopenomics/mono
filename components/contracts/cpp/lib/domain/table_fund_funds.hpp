#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <string>

#include "../consts.hpp"
#include "../core/ram_payer.hpp"

/**
 * @ingroup public_tables
 * @ingroup public_fund_tables
 * @par table: funds (fund)
 *
 * @brief Реестр фондов кооператива — настройки без остатков (задача 99D-25,
 * решение владельца 03.11.2026).
 *
 * У кооператива пять стандартных фондов, у каждого — свой кошелёк ledger2 на
 * счёте 86: кошелёк и есть субсчёт фонда, остаток и движения живут только там.
 * Эта таблица хранит то, что кошелёк хранить не может: название, описание,
 * процент отчислений (у фондов накопления) и имя кошелька. Заводится при
 * старте кооператива (`fund::init`), у действующих кооперативов — `fund::migrate`.
 * Заведение новых фондов советом не предусмотрено: имена кошельков задаются при
 * сборке контрактов.
 *
 * `percent` — доля членского взноса участка, ×10 000 (1 % = 10 000); у фондов
 * списания всегда 0.
 */
struct [[eosio::table, eosio::contract(FUND)]] fundrow {
  uint64_t id;               ///< 1 неделимый, 2 резервный, 3 развития, 4 хозяйственный, 5 взаимного обеспечения
  eosio::name coopname;      ///< Кооператив
  eosio::name kind;          ///< `accum` — фонд накопления, `expend` — фонд списания
  std::string name;          ///< Название фонда по Положению о фондах
  std::string description;   ///< Описание — правит председатель совета
  uint64_t percent;          ///< Процент отчислений ×10 000; у фондов списания 0
  eosio::name wallet;        ///< Кошелёк ledger2 фонда (счёт 86)

  uint64_t primary_key() const { return id; }
};

typedef eosio::multi_index<"funds"_n, fundrow> funds_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(fundrow, contract);
