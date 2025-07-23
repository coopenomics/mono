#include <eosio/asset.hpp>
#include <eosio/contract.hpp>
#include <eosio/crypto.hpp>
#include <eosio/eosio.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>

#include "../lib/common.hpp"

/**
 *  \ingroup public_contracts
 *
 *  @brief Класс `fund`
 *  @details

 */
class [[eosio::contract(FUND)]] fund : public eosio::contract {
 public:
  fund(eosio::name receiver, eosio::name code,
       eosio::datastream<const char *> ds)
      : eosio::contract(receiver, code, ds) {}

  void apply(uint64_t receiver, uint64_t code, uint64_t action);
  [[eosio::action]] void migrate();
  
  [[eosio::action]] void newfund(eosio::name coopname, eosio::name type,
                                 uint64_t id);
  [[eosio::action]] void newwithdraw(eosio::name coopname, eosio::name type,
                                     uint64_t id);

  [[eosio::action]] void init(eosio::name coopname, eosio::asset initial);

  // type: accumulation, expend
  [[eosio::action]] void createfund(eosio::name coopname, eosio::name username,
                                    eosio::name type, eosio::name contract,
                                    std::string name, std::string description,
                                    uint64_t percent);
  [[eosio::action]] void editfund(eosio::name coopname, eosio::name username,
                                  eosio::name type, uint64_t fund_id,
                                  eosio::name contract, std::string name,
                                  std::string description, uint64_t percent);
  [[eosio::action]] void delfund(eosio::name coopname, eosio::name username,
                                 eosio::name type, uint64_t fund_id);

  // атомарные транзакции фондового кошелька
  // паевой фонд
  [[eosio::action]] void addcirculate(
      eosio::name coopname,
      eosio::asset quantity);  /// < добавить сумму в паевой фонд
  [[eosio::action]] void subcirculate(
      eosio::name coopname,
      eosio::asset quantity,
      bool skip_available_check = false
      );  /// < списать сумму из паевого фонда

  // фонды накопления
  [[eosio::action]] void addaccum(eosio::name coopname, uint64_t fund_id,
                                  eosio::asset quantity);
  [[eosio::action]] void subaccum(eosio::name coopname, uint64_t fund_id,
                                  eosio::asset quantity);
  // списать можно только с помощью вызова метода withdraw смарт-контракта

  // счет накопления для списаний
  [[eosio::action]] void addexpense(eosio::name coopname, uint64_t fund_id,
                                    eosio::asset quantity);
  
  // добавить членский взнос на накопительный счет кооператива для дальнейшего управления
  [[eosio::action]] void accumfee(eosio::name coopname, eosio::asset quantity);
  
  //счет вступительных взносов
  [[eosio::action]] void addinitial(eosio::name coopname,
                                        eosio::asset quantity);
  
  [[eosio::action]] void subinitial(eosio::name coopname, eosio::asset quantity);
                                          
  // метод распределения членской части взноса по фондам накопления с остатком в
  // кошельке для распределения по фондам списания
  [[eosio::action]] void spreadamount(
      eosio::name coopname,
      eosio::asset quantity);  /// < распределить членские взносы по фондам
                               /// накопления, положив остаток в фондовый
                               /// кошелёк для дальнейшего списания

  // метод вывода средств из фондов накопления
  [[eosio::action]] void fundwithdraw(eosio::name coopname,
                                      eosio::name username, eosio::name type,
                                      uint64_t fund_id, document2 document,
                                      eosio::asset quantity,
                                      std::string bank_data_id);
  // используется только на фондах накопления

  // метод авторизации средств из кошелька
  [[eosio::action]] void authorize(eosio::name coopname, eosio::name type,
                                   uint64_t withdraw_id);

  // используется авторизованными участником для подтверждения совершения
  // выплаты
  [[eosio::action]] void complete(eosio::name coopname, eosio::name username,
                                  uint64_t withdraw_id);

  struct [[eosio::table, eosio::contract(FUND)]] counts : counts_base {};
};
