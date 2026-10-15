/**
 * @brief Редактирование перевода шаблона документа.
 * Изменяет данные существующего перевода шаблона документа.
 * @param scope Область видимости (кооператив или _draft)
 * @param username Имя пользователя, редактирующего перевод
 * @param translate_id Идентификатор перевода
 * @param data Новые данные перевода
 * @ingroup public_actions
 * @ingroup public_draft_actions

 * @note Авторизация требуется от аккаунта: @p scope или @p _system
 */
void draft::edittrans(eosio::name scope, eosio::name username, uint64_t translate_id, std::string data) {
  eosio::name payer = draft::get_payer_and_check_auth_in_scope(scope, username, "edittrans"_n);
  
  translations_index translations(_draft, scope.value);
  auto trans = translations.find(translate_id);
  eosio::check(trans != translations.end(), "Перевод не найден");
  
  translations.modify(trans, RamPayer::of(translations, scope), [&](auto &t){
    t.data = data;
  });

};
