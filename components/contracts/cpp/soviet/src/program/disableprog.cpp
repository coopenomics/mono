/**
 * @brief Отключение целевой программы
 * Отключает существующую целевую программу, устанавливая поле is_active в false.
 * Программа остается в системе, но становится неактивной.
 * @param coopname Наименование кооператива
 * @param program_id Идентификатор программы для отключения
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void soviet::disableprog(eosio::name coopname, uint64_t program_id) {
  require_auth(coopname);

  programs_index programs(_soviet, coopname.value);
  auto existing_program = programs.find(program_id);
  eosio::check(existing_program != programs.end(), "Программа не найдена.");

  programs.modify(existing_program, RamPayer::of(programs, coopname), [&](auto& pr) {
    pr.is_active = false;
  });
}