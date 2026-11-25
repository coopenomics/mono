#pragma once

#include "../core/ram_payer.hpp"
#include <eosio/asset.hpp>
#include <eosio/binary_extension.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>

#include "../consts.hpp"
#include "../core/utils.hpp"
#include "document_core.hpp"

/**
 * Инвестиционный этап кооперативного участка Стола заказов (задача 99D-27,
 * PRD компонента 68 «Инвестиционный этап кооперативного участка Стола
 * заказов», решения владельца 06–07.11.2026).
 *
 * Пайщик-инициатор по договору участия в хозяйственной деятельности вносит в
 * участок деньги (заявлением о трансляции паевого взноса) или имущество
 * (заявление → одобрение председателя участка → совет → акт). Деньги
 * оплачивают расходы и материальную помощь участка, пока своих средств у
 * участка не хватает; имущество в оплату не идёт. Экономия участка
 * возвращает инициаторам использованное: имущество — с момента приёма, деньги
 * — по мере оплаты расходов. Возврат делится пропорционально использованному
 * алгоритмом накопленного возврата на единицу (CRPS): прогон не перебирает
 * инициаторов, а увеличивает один счётчик участка `acc`.
 *
 * Паевой взнос инициатора на счёте 80 таблицы не трогают: он лежит на
 * кошельке `w.mkt.invest` целиком, пока инициатор сам не транслирует
 * возвращённое и неиспользованное в главный паевой заявлением.
 *
 * Все таблицы — в scope `coopname`, без истории. Строка инициатора живёт, пока
 * пайщик состоит в кооперативе: после полного возмещения она остаётся с
 * нулевым остатком (инициатор виден в участке и вернётся в распределение
 * новым взносом) и стирается при выходе из кооператива. Заявление на
 * имущество стирается после второй подписи акта.
 */

namespace MarketInvest {

/// Точность счётчика возврата: возвращено на единицу базы × SCALE.
static constexpr uint64_t SCALE = 1'000'000'000'000ULL;
/// Ключ индекса для строк вне выборки (нет неиспользованных денег / вне базы).
static constexpr uint64_t OUT_OF_RANGE = UINT64_MAX;

namespace Status {
  static constexpr eosio::name ACTIVE = "active"_n;  ///< паевой взнос возвращается из экономии участка
  static constexpr eosio::name DONE   = "done"_n;    ///< использованное возвращено, неиспользованное доступно к заявлению
}

namespace PropertyStatus {
  static constexpr eosio::name CREATED    = "created"_n;    ///< заявление подано
  static constexpr eosio::name APPROVED   = "approved"_n;   ///< председатель участка одобрил, вопрос на повестке совета
  static constexpr eosio::name AUTHORIZED = "authorized"_n; ///< совет принял решение о приёме
  static constexpr eosio::name ACT1       = "act1"_n;       ///< акт подписан вносящим
}

} // namespace MarketInvest

/**
 * @brief Договор об участии в хозяйственной деятельности кооперативного
 * участка (registry 1118). Заключается на каждый участок отдельно (решение
 * владельца 12.11.2026; прежняя таблица `invagreemnts` с договором на
 * пайщика выведена): пайщик подписывает его на странице «Инициаторы
 * участка» и затем вносит паевые взносы в этот участок.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: invagrbranch
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] mkt_invagreement {
  uint64_t              id;         ///< первичный ключ
  eosio::name           username;   ///< пайщик
  eosio::name           braname;    ///< кооперативный участок договора
  eosio::time_point_sec signed_at;  ///< время подписи
  document2             agreement;  ///< подписанный договор

  uint64_t primary_key() const { return id; }
  /// Пайщик и участок — один договор на пару.
  uint128_t by_user_branch() const { return combine_ids(username.value, braname.value); }
  uint64_t  by_branch() const { return braname.value; }
};

typedef eosio::multi_index<
  "invagrbranch"_n, mkt_invagreement,
  eosio::indexed_by<"byuserbr"_n, eosio::const_mem_fun<mkt_invagreement, uint128_t, &mkt_invagreement::by_user_branch>>,
  eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<mkt_invagreement, uint64_t, &mkt_invagreement::by_branch>>
> mkt_invagreements_index;
RAM_PAYER_CLASS(mkt_invagreement, contract);

/**
 * @brief Паевые взносы инициаторов одного кооперативного участка и счётчик
 * возврата (CRPS). Строка заводится первым паевым взносом и живёт, пока у участка
 * есть инициаторы.
 *
 * Обозначения: единицы инициатора `units_i = used_money_i + property_i`
 * (использованный паевой взнос), база `base = Σ units_i` по инициаторам в статусе
 * active, возвращено инициатору `returned_i = returned_fixed_i +
 * units_i × (acc − acc_join_i) / SCALE`. Суммы `s_join = Σ units_i × acc_join_i`
 * и `s_fixed = Σ returned_fixed_i` по базе дают непогашенный остаток участка
 * за O(1): `base − s_fixed − (acc × base − s_join) / SCALE`.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: invbranches
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] mkt_invbranch {
  eosio::name  braname;        ///< кооперативный участок (первичный ключ)
  eosio::asset money_total;    ///< внесено деньгами по строкам инициаторов участка (за вычетом забранного неиспользованного)
  eosio::asset property_total; ///< внесено имуществом по цене приёма
  eosio::asset unused_total;   ///< деньги инициаторов, ещё не израсходованные из пула и не забранные заявлением
  eosio::asset reserved;       ///< выделено в пул под расходы и помощь и ещё не израсходовано
  eosio::asset spent_total;    ///< оплачено из пула всего
  eosio::asset repaid_total;   ///< возмещено из экономии участка на w.mkt.repay всего
  eosio::asset surplus_total;  ///< переплата на границе завершения возврата, переданная на w.brn.common
  int64_t      base = 0;       ///< Σ units активных инициаторов, единицы актива
  uint64_t     acc = 0;        ///< возвращено на единицу базы × SCALE
  uint128_t    s_join = 0;     ///< Σ units_i × acc_join_i по базе
  int64_t      s_fixed = 0;    ///< Σ returned_fixed_i по базе
  uint64_t     join_seq = 0;   ///< счётчик порядка входа инициаторов (очерёдность расхода денег)
  /// Σ used_money активных инициаторов — денежная часть базы возврата. По ней
  /// возмещение делится на долю денег (гасит 26, Дт 86 / Кт 26) и долю
  /// имущества (без проводки). Поле добавлено после выпуска таблицы — в
  /// конце строки через binary_extension; у строки прежней сборки — ноль.
  eosio::binary_extension<int64_t> base_money;

  uint64_t primary_key() const { return braname.value; }
  int64_t base_money_or_zero() const { return base_money.has_value() ? base_money.value() : 0; }
};

typedef eosio::multi_index<"invbranches"_n, mkt_invbranch> mkt_invbranches_index;
RAM_PAYER_CLASS(mkt_invbranch, contract);

/**
 * @brief Инициатор кооперативного участка: одна строка на пару «участок —
 * пайщик».
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: investors
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] mkt_investor {
  uint64_t     id;               ///< суррогатный ключ
  eosio::name  braname;          ///< кооперативный участок
  eosio::name  username;         ///< пайщик-инициатор
  eosio::name  status;           ///< active | done (done с нулевым остатком — возмещено полностью)
  eosio::asset money;            ///< внесено деньгами (за вычетом забранного неиспользованного)
  eosio::asset property;         ///< внесено имуществом по цене приёма
  eosio::asset used_money;       ///< из денег израсходовано пулом участка
  eosio::asset claimed;          ///< забрано из возвращённого заявлениями (без неиспользованного)
  int64_t      returned_fixed = 0; ///< возвращено на момент последней фиксации, единицы актива
  uint64_t     acc_join = 0;     ///< счётчик участка на момент последней фиксации
  uint64_t     acc_done = 0;     ///< счётчик участка, при котором использованное будет возвращено целиком
  uint64_t     join_seq = 0;     ///< порядок входа в участок
  eosio::time_point_sec joined_at; ///< время первого паевого взноса
  /// Внесено деньгами всего; заявление о трансляции его не уменьшает.
  /// Поле добавлено после выпуска таблицы — только в конце строки и через
  /// binary_extension: строки, записанные прежней сборкой, читаются без него.
  eosio::binary_extension<eosio::asset> money_in;

  uint64_t primary_key() const { return id; }
  uint64_t by_branch() const { return braname.value; }
  uint64_t by_user() const { return username.value; }
  uint128_t by_branch_user() const { return combine_ids(braname.value, username.value); }

  int64_t units() const { return used_money.amount + property.amount; }
  /// Внесено деньгами всего; у строки прежней сборки — текущий остаток денег.
  eosio::asset money_in_or_current() const { return money_in.has_value() ? money_in.value() : money; }
  int64_t unused() const { return money.amount - used_money.amount; }

  /// Очередь расхода денег: инициаторы с неиспользованными деньгами по порядку
  /// входа. Завершивший возврат остаётся в очереди, пока не забрал деньги.
  uint128_t by_unused() const {
    const bool in_queue = unused() > 0;
    return combine_ids(braname.value, in_queue ? join_seq : MarketInvest::OUT_OF_RANGE);
  }
  /// Очередь завершения: активные в базе по счётчику полного возврата.
  uint128_t by_done() const {
    const bool in_base = status == MarketInvest::Status::ACTIVE && units() > 0;
    return combine_ids(braname.value, in_base ? acc_done : MarketInvest::OUT_OF_RANGE);
  }
};

typedef eosio::multi_index<
  "investors"_n, mkt_investor,
  eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<mkt_investor, uint64_t, &mkt_investor::by_branch>>,
  eosio::indexed_by<"byuser"_n, eosio::const_mem_fun<mkt_investor, uint64_t, &mkt_investor::by_user>>,
  eosio::indexed_by<"bybruser"_n, eosio::const_mem_fun<mkt_investor, uint128_t, &mkt_investor::by_branch_user>>,
  eosio::indexed_by<"byunused"_n, eosio::const_mem_fun<mkt_investor, uint128_t, &mkt_investor::by_unused>>,
  eosio::indexed_by<"bydone"_n, eosio::const_mem_fun<mkt_investor, uint128_t, &mkt_investor::by_done>>
> mkt_investors_index;
RAM_PAYER_CLASS(mkt_investor, contract);

/**
 * @brief Заявление инициатора о паевом взносе имуществом в кооперативный
 * участок (registry 1120) до второй подписи акта. Путь как у Благороста:
 * заявление → одобрение председателя участка → решение совета → акт (вносящий,
 * затем председатель участка). Строка стирается после второй подписи или
 * отказа; принятое имущество учтено в строке инициатора и в ledger2.
 *
 * @ingroup public_tables
 * @ingroup public_marketplace_tables
 * @par table: invprops
 */
struct [[eosio::table, eosio::contract(MARKETPLACE)]] mkt_invprop {
  uint64_t     id;             ///< суррогатный ключ
  checksum256  hash;           ///< хэш паевого взноса имуществом (процесс p.mkt.invest)
  eosio::name  braname;        ///< кооперативный участок
  eosio::name  username;       ///< вносящий пайщик
  eosio::name  status;         ///< created | approved | authorized | act1
  eosio::asset amount;         ///< цена приёма, названная вносящим
  std::string  description;    ///< наименование, описание, количество
  document2    statement;      ///< заявление 1120, подпись вносящего
  document2    approved_statement; ///< то же заявление с подписью председателя участка
  document2    decision;       ///< протокол решения совета 1121
  document2    act;            ///< акт приёма-передачи 1122
  eosio::time_point_sec created_at; ///< время подачи

  uint64_t primary_key() const { return id; }
  checksum256 by_hash() const { return hash; }
  uint64_t by_branch() const { return braname.value; }
  uint64_t by_user() const { return username.value; }
};

typedef eosio::multi_index<
  "invprops"_n, mkt_invprop,
  eosio::indexed_by<"byhash"_n, eosio::const_mem_fun<mkt_invprop, checksum256, &mkt_invprop::by_hash>>,
  eosio::indexed_by<"bybranch"_n, eosio::const_mem_fun<mkt_invprop, uint64_t, &mkt_invprop::by_branch>>,
  eosio::indexed_by<"byuser"_n, eosio::const_mem_fun<mkt_invprop, uint64_t, &mkt_invprop::by_user>>
> mkt_invprops_index;
RAM_PAYER_CLASS(mkt_invprop, contract);
