/**
 * @brief Утверждение редакции шаблона документа советом кооператива.
 * Фиксирует, что совет кооператива решением @p decision_id принял редакцию
 * @p version шаблона @p registry_id. С этого момента кооператив предъявляет
 * пайщикам и пишет в их подписи именно эту редакцию. Пока утверждения нет,
 * действует текущая редакция сети.
 * @param coopname Наименование кооператива
 * @param username Имя пользователя, фиксирующего утверждение (председатель или сам кооператив)
 * @param registry_id Реестровый идентификатор шаблона
 * @param version Утверждаемая редакция; обязана совпадать с текущей редакцией шаблона в сети
 * @param decision_id Номер решения совета (номер протокола)
 * @param approved_at Дата решения совета
 * @param text_hash Хэш текста утверждённой редакции
 * @ingroup public_actions
 * @ingroup public_draft_actions

 * @note Авторизация требуется от аккаунта: @p coopname или @p username с правом действия
 */
void draft::approve(eosio::name coopname, eosio::name username, uint64_t registry_id, uint64_t version,
                    uint64_t decision_id, eosio::time_point_sec approved_at, eosio::checksum256 text_hash) {
  eosio::check(coopname != _draft, "Утверждение ведётся в области кооператива");

  eosio::name payer = draft::get_payer_and_check_auth_in_scope(coopname, username, "approve"_n);

  auto current = get_scoped_draft_by_registry_or_fail(_draft, registry_id);
  eosio::check(current.version == version,
               "Утверждаемая редакция не совпадает с текущей редакцией шаблона в сети");
  eosio::check(decision_id > 0, "Не указан номер решения совета");

  draft_approvals_index approvals(_draft, coopname.value);
  auto exist = approvals.find(registry_id);

  if (exist == approvals.end()) {
    approvals.emplace(payer, [&](auto &a) {
      a.registry_id = registry_id;
      a.version = version;
      a.decision_id = decision_id;
      a.approved_at = approved_at;
      a.text_hash = text_hash;
    });
  } else {
    approvals.modify(exist, payer, [&](auto &a) {
      a.version = version;
      a.decision_id = decision_id;
      a.approved_at = approved_at;
      a.text_hash = text_hash;
    });
  }
}
