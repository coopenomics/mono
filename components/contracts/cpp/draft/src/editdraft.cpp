/**
 * @brief Редактирование существующего шаблона документа.
 * Изменяет параметры существующего шаблона документа.
 * @param scope Область видимости (кооператив или _draft)
 * @param username Имя пользователя, редактирующего шаблон
 * @param registry_id Реестровый идентификатор шаблона
 * @param title Новый заголовок шаблона
 * @param description Новое описание шаблона
 * @param context Новый контекст шаблона
 * @param model Новая модель шаблона
 * @ingroup public_actions
 * @ingroup public_draft_actions

 * @note Авторизация требуется от аккаунта: @p scope или @p _system
 */
void draft::editdraft(eosio::name scope, eosio::name username, uint64_t registry_id, std::string title, std::string description, std::string context, std::string model){
  eosio::name payer = draft::get_payer_and_check_auth_in_scope(scope, username, "editdraft"_n);
  
  drafts_index drafts(_draft, scope.value);
  auto exist = drafts.find(registry_id);
  
  eosio::check(exist != drafts.end(), "Шаблон не найден");

  drafts.modify(exist, RamPayer::of(drafts, scope), [&](auto &d){
    d.title = title;
    d.description = description;
    d.context = context;
    d.model = model;
  });
}
