#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/index.hpp"

/**
\defgroup public_fund Контракт FUND

* Реестр фондов кооператива (задача 99D-25, решение владельца 03.11.2026).
* Пять стандартных фондов живут на кошельках ledger2 счёта 86 — кошелёк и есть
* субсчёт фонда, остатки и движения ведёт ledger2. Контракт хранит настройки
* фондов (название, описание, процент отчислений, кошелёк) и делит отчисления из
* членских взносов между фондами накопления по их процентам.
*
* Прежний учёт остатков в собственных таблицах (`coopwallet`, `accfunds`,
* `expfunds`, `fwithdraws`) отключён: действия отвечают отказом `FUND_DEPRECATED`,
* строки стирает `cleanup` на деплое. Сигнатуры действий сохранены.
*/

/**
\defgroup public_fund_processes Процессы
\ingroup public_fund
*/

/**
\defgroup public_fund_actions Действия
\ingroup public_fund
*/

/**
\defgroup public_fund_tables Таблицы
\ingroup public_fund
*/

/**
 * @brief Реестр фондов кооператива
 * @ingroup public_fund
 */
class [[eosio::contract(FUND)]] fund : public coop_contract {
 public:
  fund(eosio::name receiver, eosio::name code,
       eosio::datastream<const char *> ds)
      : coop_contract(receiver, code, ds) {}

  void apply(uint64_t receiver, uint64_t code, uint64_t action);

  /// Доводит действующие кооперативы до пяти стандартных фондов в `funds`; идемпотентно.
  [[eosio::action]] void migrate();
  /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
  [[eosio::action]] void cleanup();

  /// Заводит пять стандартных фондов кооператива при его старте; повторный вызов ничего не меняет.
  [[eosio::action]] void init(eosio::name coopname, eosio::asset initial);

  /// Председатель совета правит описание и процент фонда накопления (у фонда списания — только описание).
  [[eosio::action]] void editfund(eosio::name coopname, eosio::name username,
                                  eosio::name type, uint64_t fund_id,
                                  eosio::name contract, std::string name,
                                  std::string description, uint64_t percent);

  /// Отчисление в фонды накопления по их процентам на кошельки ledger2; зовёт контракт-источник инлайн в нитке своего процесса.
  [[eosio::action]] void accrue(eosio::name coopname, eosio::name source_contract,
                                eosio::asset amount, eosio::name process_type,
                                eosio::checksum256 process_hash, std::string memo);

  // ── Набор фондов фиксирован: заведение и удаление отвечают FUND_FUNDS_FIXED ──
  [[eosio::action]] void createfund(eosio::name coopname, eosio::name username,
                                    eosio::name type, eosio::name contract,
                                    std::string name, std::string description,
                                    uint64_t percent);
  [[eosio::action]] void delfund(eosio::name coopname, eosio::name username,
                                 eosio::name type, uint64_t fund_id);

  // ── Прежний учёт остатков — отключён, действия отвечают FUND_DEPRECATED ──
  // Сигнатуры сохранены: прежние вызовы получают понятный отказ, а не ошибку ABI.
  [[eosio::action]] void newfund(eosio::name coopname, eosio::name type,
                                 uint64_t id);
  [[eosio::action]] void newwithdraw(eosio::name coopname, eosio::name type,
                                     uint64_t id);
  [[eosio::action]] void addcirculate(eosio::name coopname, eosio::asset quantity);
  [[eosio::action]] void subcirculate(eosio::name coopname, eosio::asset quantity,
                                      bool skip_available_check = false);
  [[eosio::action]] void addaccum(eosio::name coopname, uint64_t fund_id,
                                  eosio::asset quantity);
  [[eosio::action]] void subaccum(eosio::name coopname, uint64_t fund_id,
                                  eosio::asset quantity);
  [[eosio::action]] void addexpense(eosio::name coopname, uint64_t fund_id,
                                    eosio::asset quantity);
  [[eosio::action]] void accumfee(eosio::name coopname, eosio::asset quantity);
  [[eosio::action]] void addinitial(eosio::name coopname, eosio::asset quantity);
  [[eosio::action]] void subinitial(eosio::name coopname, eosio::asset quantity);
  [[eosio::action]] void spreadamount(eosio::name coopname, eosio::asset quantity);
  [[eosio::action]] void fundwithdraw(eosio::name coopname,
                                      eosio::name username, eosio::name type,
                                      uint64_t fund_id, document2 document,
                                      eosio::asset quantity,
                                      std::string bank_data_id);
  [[eosio::action]] void authorize(eosio::name coopname, eosio::name type,
                                   uint64_t withdraw_id);
  [[eosio::action]] void complete(eosio::name coopname, eosio::name username,
                                  uint64_t withdraw_id);

  struct [[eosio::table, eosio::contract(FUND)]] counts : counts_base {};
};

// Плательщик за оперативную память строк таблицы — правило в lib/core/ram_payer.hpp.
RAM_PAYER_CLASS(fund::counts, contract);
