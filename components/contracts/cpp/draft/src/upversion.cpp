/**
 * @brief Увеличение версии шаблона документа.
 * Увеличивает версию существующего шаблона документа на единицу.
 * @param scope Область видимости (кооператив или _draft)
 * @param username Имя пользователя, увеличивающего версию
 * @param registry_id Реестровый идентификатор шаблона
 * @ingroup public_actions
 * @ingroup public_draft_actions

 * @note Авторизация требуется от аккаунта: @p scope или @p _system
 */
void draft::upversion(eosio::name scope, eosio::name username, uint64_t registry_id){
  eosio::name payer = draft::get_payer_and_check_auth_in_scope(scope, username, "editdraft"_n);
  
  drafts_index drafts(_draft, scope.value);
  auto exist = drafts.find(registry_id);
  
  eosio::check(exist != drafts.end(), "Шаблон не найден");

  drafts.modify(exist, RamPayer::of(drafts, scope), [&](auto &d){
    d.version = exist -> version + 1;
  });
}
