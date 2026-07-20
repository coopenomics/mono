
/**
 * @brief Инициализация контракта совета
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _system
 */
[[eosio::action]] void soviet::init() {
  require_auth(_system);
  
  // participants_index participants(_soviet, _provider.value);
    
  // participants.emplace(_system, [&](auto &m){
  //     m.username = _provider_chairman;
  //     m.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  //     m.last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  //     m.last_min_pay = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  //     m.status = "accepted"_n;
  //     m.is_initial = true;
  //     m.is_minimum = true;
  //     m.has_vote = true;  
  //     m.type="individual"_n;  
  //     m.initial_amount = _provider_initial;
  //     m.minimum_amount = _provider_minimum;
  //   });

  //   board_member member {
  //       .username = _provider_chairman,
  //       .is_voting = true,
  //       .position_title = "Председатель",
  //       .position = "chairman"_n
  //   };

  //   std::vector<board_member> members;
  //   members.push_back(member);    

  //   boards_index boards(_soviet, _provider.value);
    
  //   boards.emplace(_system, [&](auto &b) {
  //     b.id = boards.available_primary_key();
  //     b.type = "soviet"_n;
  //     b.members = members;
  //     b.name = "Совет провайдера";
  //     b.description = "";
  //     b.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  //     b.last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  //   });

    // addresses_index addresses(_soviet, _provider.value);
    // address_data data;

    // addresses.emplace(_system, [&](auto &a) {
    //   a.id = 0;
    //   a.coopname = _provider;
    //   a.data = data;
    // });
    
    //создаём базовые кооперативые соглашения
    // soviet::make_base_coagreements(_provider, _root_govern_symbol);
    
    //инициализируем фонды
    action(
      permission_level{ _soviet, "active"_n},
      _fund,
      "init"_n,
      std::make_tuple(_provider, _provider_initial)
    ).send();

}


//создаём обязательные программы и соглашения
void soviet::make_base_coagreements( eosio::name coopname, eosio::symbol govern_symbol) {
    coagreements_index coagreements(_soviet, coopname.value);
    
    programs_index programs(_soviet, coopname.value);
    auto wallet_program_id = get_global_id_in_scope(_soviet, coopname, "programs"_n);
  
    //создаём программу кошелька
    programs.emplace(_soviet, [&](auto &pr) {
      pr.id = wallet_program_id;
      pr.program_type = _wallet_program;
      pr.is_active = true;
      pr.draft_id = 1;
      pr.coopname = coopname;
      pr.title = "Цифровой Кошелёк";
      pr.announce = "";
      pr.description = "";
      pr.preview = "";
      pr.images = "";
      pr.calculation_type = "free"_n;
      pr.fixed_membership_contribution = asset(0, govern_symbol);  
      pr.membership_percent_fee = 0;
      pr.meta = "";
      pr.is_can_coop_spend_share_contributions = false;
      pr.share_contributions = eosio::asset(0, govern_symbol);
      pr.membership_contributions = eosio::asset(0, govern_symbol);
      
      pr.available = eosio::asset(0, govern_symbol);
      pr.spendeded = eosio::asset(0, govern_symbol);
      pr.blocked = eosio::asset(0, govern_symbol);
      
    });
  
    //создаём соглашение для программы кошелька    
    coagreements.emplace(_soviet, [&](auto &row){
      row.type = "wallet"_n;
      row.coopname = coopname;
      row.program_id = wallet_program_id;
      row.draft_id = 1;
    });
    
    //создаём соглашение для шаблона простой электронной подписи
    coagreements.emplace(_soviet, [&](auto &row){
      row.type = "signature"_n;
      row.coopname = coopname;
      row.program_id = 0;
      row.draft_id = 2;
    });

    //создаём соглашение для шаблона пользовательского соглашения
    coagreements.emplace(_soviet, [&](auto &row){
      row.type = "user"_n;
      row.coopname = coopname;
      row.program_id = 0;
      row.draft_id = 4;
    });
    
    //создаём соглашение для шаблона политики конфиденциальности
    coagreements.emplace(_soviet, [&](auto &row){
      row.type = "privacy"_n;
      row.coopname = coopname;
      row.program_id = 0;
      row.draft_id = 3;
    });
    
}
