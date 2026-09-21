/**
 * @brief Отмена голосования членом совета
 * Позволяет члену совета отменить свой голос, поданный ранее, по конкретному решению.
 * В настоящее время отмена голоса запрещена (функция возвращает ошибку).
 * @param coopname Наименование кооператива
 * @param member Наименование члена совета, отменяющего свое голосование
 * @param decision_id Идентификатор решения, по которому голосование было проведено
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p member или @p permission_level{member, "provide"_n}
 */
void soviet::cancelvote(eosio::name coopname, eosio::name member, uint64_t decision_id) {
  
  if (!has_auth(member)) {
    require_auth(permission_level{member, "provide"_n});
  } else {
    require_auth(member);
  }

  eosio::check(false, "Отмена голоса запрещена");
  
  decisions_index decisions(_soviet, coopname.value); 
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ не найден");
  
  // Удаление голоса "за", если он существует
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);

  auto vote_for_it = std::find(decision->votes_for.begin(), decision->votes_for.end(), member);
  if (vote_for_it != decision->votes_for.end()) {
    uint64_t total_members = board.get_members_count();
    uint64_t consensus_percent = 50;

    decisions.modify(decision, RamPayer::of(decisions, coopname), [&](auto& row) {
      row.votes_for.erase(vote_for_it);
      uint64_t votes_for_count = row.votes_for.size();
      row.approved = (votes_for_count * 100 / total_members) > consensus_percent;
    });
  }

  // Удаление голоса "против", если он существует
  auto vote_against_it = std::find(decision->votes_against.begin(), decision->votes_against.end(), member);
  if (vote_against_it != decision->votes_against.end()) {
    decisions.modify(decision, RamPayer::of(decisions, coopname), [&](auto& row) {
      row.votes_against.erase(vote_against_it);
    });
  }
}
