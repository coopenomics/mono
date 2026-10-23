/**
 * @brief Редактирование целевой программы
 * Модифицирует существующую целевую программу в кооперативе.
 * Позволяет изменить основные параметры программы.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, редактирующего программу
 * @param program_id Идентификатор программы для редактирования
 * @param draft_id Идентификатор шаблона
 * @param title Название программы
 * @param announce Объявление о программе
 * @param description Описание программы
 * @param preview Предварительный просмотр
 * @param images Изображения для программы
 * @param meta Дополнительные метаданные
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username
 */
void soviet::editprog(eosio::name coopname, eosio::name username, uint64_t program_id, uint64_t draft_id, std::string title, std::string announce, std::string description, std::string preview, std::string images, std::string meta) {
  check_auth_or_fail(_soviet, coopname, username, "editprog"_n);
  
  programs_index programs(_soviet, coopname.value);
  auto existing_program = programs.find(program_id);
  eosio::check(existing_program != programs.end(), "Программа не найдена.");

  programs.modify(existing_program, RamPayer::of(programs, coopname), [&](auto& pr) {
    pr.draft_id = draft_id;
    pr.title = title;
    pr.announce = announce;
    pr.description = description;
    pr.preview = preview;
    pr.images = images;
    pr.meta = meta;
  });
}