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

  // Форма собрания закрепляется здесь — при одобрении советом, до рассылки
  // уведомлений: с этого момента известно, кого оповещать и кто голосует.
  // Повторное собрание (onrestart) снова получает одобрение совета этим действием и закрепляет форму по
  // составу на новое одобрение; голоса участков прошлого цикла сбрасываются.
  auto cooperative = get_cooperative_or_fail(coopname);
  meet_form form;
  form.is_branched = cooperative.is_branched;
  form.branches_count = cooperative.is_branched ? Branch::get_branch_count(coopname) : 0;
  form.fixed_at = eosio::time_point_sec(current_time_point());

  //TODO: change payer to coopname
  genmeets.modify(genmeet, RamPayer::of(genmeets, coopname), [&](auto &gm){
    gm.status = "authorized"_n;
    gm.authorization = authorization;
    gm.form.emplace(form);
  });
};
