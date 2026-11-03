#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @brief Итог прогона списания обеспечительной части по кооперативному участку
 * Стола заказов (задача 99D-21, КЭУ-3; документ «Коэффициент экономического
 * участия», разделы 8–9).
 *
 * Первого числа ИСТОК отбирает заказы участка, у которых закончился гарантийный
 * срок, и передаёт контракту факты прогона: стоимость этих заказов, собранную
 * обеспечительную часть, плановые расходы, служебные записки и выплаченную
 * материальную помощь за закончившийся месяц. Контракт считает членский взнос
 * участка, отчисления в фонды, долю инициатора, возврат пайщикам и три ставки,
 * по которым затем делится списание каждого заказа (`chargeperiod`).
 *
 * Строка — основание списания для пайщиков: после записи она неизменна. У
 * участка в оперативной памяти цепи не больше двух строк: текущий прогон и
 * предыдущий (его `aid_reserve` нужен для невыплаченной части). Позапрошлую
 * строку ИСТОК стирает действием `delperiod`; история прогонов — в базе ИСТОКА.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: kuperiods
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] kuperiod {
  uint64_t     id;                 ///< суррогатный ключ (scope coopname)
  eosio::name  braname;            ///< кооперативный участок
  uint32_t     period;             ///< номер прогона: год × 12 + месяц по часовому поясу кооператива (даёт ИСТОК)

  eosio::asset turnover;           ///< T — стоимость заказов прогона
  eosio::asset secured;            ///< C — собранная обеспечительная часть прогона
  eosio::asset planned;            ///< ПР — плановые расходы участка за месяц
  eosio::asset memos;              ///< СЗ — служебные записки сверх плана за месяц
  eosio::asset aid_paid;           ///< МП — материальная помощь, выплаченная за месяц
  eosio::asset aid_reserve;        ///< Р — резерв социально-экономического обеспечения пайщиков на следующий месяц
  eosio::asset aid_unpaid;         ///< Н — невыплаченная часть прошлого резерва
  eosio::asset expenses;           ///< РК — расходы участка за прогон
  eosio::asset membership;         ///< М — членский взнос участка за прогон
  eosio::asset funds_amount;       ///< Ф — в фонды накопления кооператива
  eosio::asset branch_amount;      ///< У — участку на расходы
  eosio::asset initiator_amount;   ///< И — инициатору участка
  eosio::asset return_amount;      ///< В — пайщикам обратно
  eosio::asset deficit;            ///< Д — дефицит участка

  uint64_t     rate_branch;        ///< r_ку — доля стоимости заказа участку (HUNDR_PERCENTS = 100 %)
  uint64_t     rate_funds;         ///< r_ф — доля в фонды
  uint64_t     rate_initiator;     ///< r_и — доля инициатору

  eosio::name  initiator;          ///< получатель доли инициатора на момент прогона
  eosio::time_point_sec closed_at; ///< время расчёта

  uint64_t  primary_key() const { return id; }
  uint64_t  by_branch() const { return braname.value; }
  uint128_t by_branch_period() const { return combine_ids(braname.value, period); }
};

typedef eosio::multi_index<
    "kuperiods"_n, kuperiod,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<kuperiod, uint64_t, &kuperiod::by_branch>>,
    eosio::indexed_by<"bybrperiod"_n, eosio::const_mem_fun<kuperiod, uint128_t, &kuperiod::by_branch_period>>>
    kuperiods_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(kuperiod, contract);
