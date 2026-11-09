#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"

/**
 * @brief Счётчики обеспечительной части к списанию (задача 99D-33).
 *
 * До этой задачи суммы списания первого числа контракту называл узел по своему
 * зеркалу заказов: строка заказа стирается при выплате поставщику, и к моменту
 * списания контракт стоимости заказа уже не видел. Деньги пайщика делились по
 * данным, которые контракт не проверял. Теперь всё, что нужно списанию, контракт
 * копит сам в момент выдачи и стирает при списании; строки заказов живут
 * столько же, сколько прежде.
 *
 * Две таблицы, обе маленькие:
 *  - `kudues` — счётчик пайщика за период списания: ключ (пайщик, участок,
 *    период), стоимость выданных заказов, обеспечительная часть к списанию по
 *    ставкам итога и удержание при отказе (целиком участку). Списание — одна
 *    транзакция `chargeperiod` на строку, строка стирается. Двойное списание
 *    невозможно: строки нет.
 *  - `kucounters` — счётчик участка за период: стоимость заказов и собранная
 *    обеспечительная часть, по которым `closeperiod` считает ставки. Строка
 *    стирается расчётом итога.
 *
 * Период списания считает контракт: номер периода по концу гарантийного срока
 * заказа (`Branch::aid_period` — календарный месяц UTC либо отрезок длины
 * `brnconfig.aid_period_seconds` на стенде со сжатым временем). Удержание при
 * отказе гарантии не имеет и попадает в текущий период.
 *
 * Память под счётчики оплачивает контракт, а не кооператив (решение владельца
 * 09.11.2026): это служебный учёт, не документ бизнес-процесса.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: kudues
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] kudue {
  uint64_t     id;                 ///< суррогатный ключ (scope coopname)
  eosio::name  username;           ///< пайщик — владелец кошелька к списанию w.mkt.due
  eosio::name  braname;            ///< кооперативный участок выдачи — получатель членского взноса
  uint32_t     period;             ///< период списания (`Branch::aid_period` по концу гарантийного срока)

  eosio::asset turnover;           ///< стоимость выданных заказов периода (факт выдачи, o.mkt.consum) за вычетом возвращённого
  eosio::asset due;                ///< обеспечительная часть к списанию по ставкам итога (o.mkt.todue выдачи) за вычетом возвращённого
  eosio::asset retained;           ///< удержание при отказе от получения (o.mkt.penal и половина обеспечительной части) — целиком участку
  uint32_t     orders;             ///< выданных заказов в строке (для показа; возвраты и отказы не уменьшают)

  uint64_t  primary_key() const { return id; }
  uint64_t  by_user() const { return username.value; }
  uint64_t  by_branch() const { return braname.value; }
  uint128_t by_branch_period() const { return combine_ids(braname.value, period); }
};

typedef eosio::multi_index<
    "kudues"_n, kudue,
    eosio::indexed_by<"byuser"_n, eosio::const_mem_fun<kudue, uint64_t, &kudue::by_user>>,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<kudue, uint64_t, &kudue::by_branch>>,
    eosio::indexed_by<"bybrperiod"_n, eosio::const_mem_fun<kudue, uint128_t, &kudue::by_branch_period>>>
    kudues_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(kudue, contract);

/**
 * @brief Счётчик участка за период списания: суммы, по которым `closeperiod`
 * считает ставки итога (задача 99D-33). Одна строка на (участок, период);
 * у участка открыто столько строк, на сколько периодов вперёд дотягиваются
 * гарантийные сроки выданных заказов. Стирается расчётом итога.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: kucounters
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] kucounter {
  uint64_t     id;                 ///< суррогатный ключ (scope coopname)
  eosio::name  braname;            ///< кооперативный участок
  uint32_t     period;             ///< период списания

  eosio::asset turnover;           ///< T — стоимость выданных заказов периода за вычетом возвращённого
  eosio::asset secured;            ///< C — обеспечительная часть к списанию по ставкам за вычетом возвращённого
  eosio::asset retained;           ///< удержания при отказе за период (в формулу итога не входят, целиком участку)
  uint32_t     orders;             ///< выданных заказов за период
  uint32_t     members;            ///< строк счётчиков пайщиков за период (сколько транзакций списания предстоит)

  uint64_t  primary_key() const { return id; }
  uint64_t  by_branch() const { return braname.value; }
  uint128_t by_branch_period() const { return combine_ids(braname.value, period); }
};

typedef eosio::multi_index<
    "kucounters"_n, kucounter,
    eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<kucounter, uint64_t, &kucounter::by_branch>>,
    eosio::indexed_by<"bybrperiod"_n, eosio::const_mem_fun<kucounter, uint128_t, &kucounter::by_branch_period>>>
    kucounters_index;

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(kucounter, contract);
