/**
 * @brief Авторизация собрания советом.
 * Подтверждает проведение собрания после одобрения советом
 * @param coopname Наименование кооператива
 * @param hash Хэш собрания
 * @param authorization Документ авторизации от совета
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void meet::authmeet(eosio::name coopname, checksum256 hash, document2 authorization) {
  require_auth(_soviet);
  
  auto exist_meet = get_meet(coopname, hash);
  eosio::check(exist_meet.has_value(), "Собрание не найдено");
  
  Meet::meets_index genmeets(_meet, coopname.value);
  auto genmeet = genmeets.find(exist_meet -> id);
  eosio::check(genmeet -> status == "onrestart"_n || genmeet -> status == "created"_n, "Собрание не находится в неподходящем статусе");

  if (!TEST_MODE)
    eosio::check(genmeet -> open_at.sec_since_epoch() >= current_time_point().sec_since_epoch() + MIN_OPEN_AGM_DELAY_SEC,
             "Дата открытия должна быть по крайней мере через 15 дней от момента решения совета");

  //TODO: change payer to coopname
  genmeets.modify(genmeet, RamPayer::of(genmeets, coopname), [&](auto &gm){
    gm.status = "authorized"_n;
    gm.authorization = authorization;
  });
};
