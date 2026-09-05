/**
 * @brief Включение или изменение автоматизации решений совета
 *
 * Член совета делегирует роботу решений совета голос по типам решений в одном из двух
 * режимов: «сразу» — робот голосует «за» при появлении повестки; «как другой член совета» —
 * робот повторяет голос названного члена совета с тем же знаком и только после него.
 * Председатель дополнительно доверяет роботу подпись протоколов по своему списку типов. Подписи ставятся ключом отдельного разрешения аккаунта члена совета, которое он
 * заводит сам (updateauth) и ключ которого передаёт роботу; в цепи ключ не хранится.
 * Повторный вызов заменяет прежние настройки: одна запись на члена совета.
 *
 * @param coopname Наименование кооператива
 * @param board_id Идентификатор совета кооператива
 * @param member Член совета, который включает автоматизацию
 * @param permission_name Разрешение аккаунта члена совета с ключом робота (не active и не owner)
 * @param vote_types Типы решений, по которым робот голосует «за» сразу при появлении повестки
 * @param follow_rules Типы решений, по которым робот повторяет голос другого члена совета (пара «тип → за кем»)
 * @param authorize_types Типы решений, протоколы которых робот подписывает от имени председателя (только председатель)
 * @param limit Лимит суммы на одно решение; нулевая сумма — без лимита
 * @param expires_at Срок действия автоматизации; нулевое значение — бессрочно
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p member
 */
void soviet::automate(eosio::name coopname, uint64_t board_id, eosio::name member, eosio::name permission_name,
                      std::vector<eosio::name> vote_types, std::vector<follow_rule> follow_rules,
                      std::vector<eosio::name> authorize_types, eosio::asset limit, eosio::time_point_sec expires_at) {
  require_auth(member);

  boards_index boards(_soviet, coopname.value);
  auto board = boards.find(board_id);
  eosio::check(board != boards.end(), "Совет не найден");
  eosio::check(board->type == "soviet"_n, "Автоматизация решений доступна только совету кооператива");
  eosio::check(board->is_valid_member(member), "Только член совета может включить автоматизацию");

  eosio::check(permission_name != ""_n && permission_name != "active"_n && permission_name != "owner"_n,
               "Роботу выдаётся отдельное разрешение аккаунта, а не active или owner");
  eosio::check(!vote_types.empty() || !follow_rules.empty() || !authorize_types.empty(),
               "Укажите хотя бы один тип решения для автоматизации");

  if (!vote_types.empty() || !follow_rules.empty()) {
    eosio::check(board->is_voting_member(member), "У члена совета нет права голоса");
  }
  for (const auto& type : vote_types) {
    eosio::check(soviet_actions.contains(type), "Недопустимый тип решения для голосования: " + type.to_string());
  }
  // Режим повтора: за кем — только голосующий член совета и не сам себе; на тип — один режим.
  for (const auto& rule : follow_rules) {
    eosio::check(soviet_actions.contains(rule.decision_type),
                 "Недопустимый тип решения для повтора голоса: " + rule.decision_type.to_string());
    eosio::check(rule.follow != member, "Повторять за самим собой нельзя");
    eosio::check(board->is_voting_member(rule.follow), "Повторять можно только за голосующим членом совета");
    eosio::check(std::find(vote_types.begin(), vote_types.end(), rule.decision_type) == vote_types.end(),
                 "По одному типу решения — один режим: либо сразу, либо повтор за членом совета");
    size_t same = 0;
    for (const auto& other : follow_rules) {
      if (other.decision_type == rule.decision_type) same++;
    }
    eosio::check(same == 1, "По одному типу решения нельзя повторять за несколькими членами совета");
  }

  if (!authorize_types.empty()) {
    eosio::check(board->is_valid_chairman(member), "Автоматическую подпись протоколов может включить только председатель совета");
    for (const auto& type : authorize_types) {
      eosio::check(soviet_actions.contains(type), "Недопустимый тип решения для подписи протокола: " + type.to_string());
    }
  }

  eosio::check(limit.is_valid() && limit.amount >= 0, "Некорректный лимит");
  eosio::check(limit.symbol == _root_govern_symbol, "Лимит указывается в валюте кооператива");

  auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  if (expires_at.sec_since_epoch() != 0) {
    eosio::check(expires_at > now, "Срок действия автоматизации уже истёк");
  }

  automator_index automator(_soviet, coopname.value);
  auto by_member = automator.get_index<"bymember"_n>();
  auto existing = by_member.find(member.value);

  if (existing == by_member.end()) {
    automator.emplace(member, [&](auto& a) {
      a.id = automator.available_primary_key();
      a.coopname = coopname;
      a.board_id = board_id;
      a.member = member;
      a.permission_name = permission_name;
      a.vote_types = vote_types;
      a.follow_rules = follow_rules;
      a.authorize_types = authorize_types;
      a.limit = limit;
      a.expires_at = expires_at;
      a.created_at = now;
      a.updated_at = now;
    });
  } else {
    by_member.modify(existing, member, [&](auto& a) {
      a.board_id = board_id;
      a.permission_name = permission_name;
      a.vote_types = vote_types;
      a.follow_rules = follow_rules;
      a.authorize_types = authorize_types;
      a.limit = limit;
      a.expires_at = expires_at;
      a.updated_at = now;
    });
  }
}
