#pragma once

struct [[eosio::table, eosio::contract(BRANCH)]] branchstat {
  eosio::name coopname;
  uint64_t count;
  
  uint64_t primary_key() const { return coopname.value; }
};

typedef eosio::multi_index<"branchstat"_n, branchstat> branchstat_index;

uint64_t add_branch_count(eosio::name coopname){
  branchstat_index stat(_branch, _branch.value);
  auto st = stat.find(coopname.value);
  
  uint64_t new_count = 0;
  
  if (st == stat.end()){
    new_count = 1;
    stat.emplace(coopname, [&](auto &s){
      s.coopname = coopname;
      s.count = new_count;
    });
  } else {
    new_count = st -> count + 1;
    stat.modify(st, coopname, [&](auto &s){
      s.count += 1;
    });
  };  
  
  return new_count;
};

uint64_t sub_branch_count(eosio::name coopname){
  branchstat_index stat(_branch, _branch.value);
  auto st = stat.find(coopname.value);
  uint64_t new_count = 0;
  
  eosio::check(st != stat.end(), "Нет кооперативных участков");
  eosio::check( st -> count > 0, "Системная ошибка");
  
  new_count = st -> count - 1;
  
  stat.modify(st, coopname, [&](auto &s){
    s.count -= 1;
  });
  
  return new_count;
};


/**
 * @ingroup public_tables
 * @brief Структура, представляющая кооперативные участка.
 * @details Эта структура содержит информацию о кооперативных участках.
 */
struct [[eosio::table, eosio::contract(BRANCH)]] coobranch {
  eosio::name braname;
  eosio::name trustee;
  std::vector<eosio::name> trusted;
  

  uint64_t primary_key() const { return braname.value; }
  uint64_t by_trustee() const { return trustee.value; }
  
  void add_account_to_trusted(const eosio::name& account) {
    trusted.push_back(account);
  }

  void remove_account_from_trusted(const eosio::name& account) {
    auto itr = std::remove(trusted.begin(), trusted.end(), account);
    check(itr != trusted.end(), "Account not found in trusted list");
    trusted.erase(itr, trusted.end());
  }

  bool is_account_in_trusted(const eosio::name& account) const {
    return std::find(trusted.begin(), trusted.end(), account) != trusted.end();
  }

  /**
   * @brief Проверяет права доступа пользователя к данному кооперативному участку
   * @param username Имя пользователя для проверки
   * @return true если пользователь имеет права доступа, false в противном случае
   */
  bool is_user_authorized(const eosio::name& username) const {
    // Проверяем является ли пользователь доверенным лицом (trustee)
    if (trustee == username) {
      return true;
    }
    
    // Проверяем находится ли пользователь в списке доверенных (trusted)
    return is_account_in_trusted(username);
  }
};

typedef eosio::multi_index<"branches"_n, coobranch,
  eosio::indexed_by<"bytrustee"_n, eosio::const_mem_fun<coobranch, uint64_t, &coobranch::by_trustee>>
> branch_index;


coobranch get_branch_or_fail(eosio::name coopname, eosio::name braname) {
  branch_index branches(_branch, coopname.value);
  auto branch = branches.find(braname.value);

  eosio::check(branch != branches.end(), "Кооперативный Участок не найден");
  
  return *branch;
};

