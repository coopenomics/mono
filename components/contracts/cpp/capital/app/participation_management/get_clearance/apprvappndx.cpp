void capital::apprvappndx(eosio::name coopname, eosio::name username, checksum256 appendix_hash, document2 approved_document) {
  require_auth(_soviet);
  
  // === ВСЕ ЧТЕНИЯ В НАЧАЛЕ ===
  auto appendix = Capital::Appendix::get_appendix(coopname, appendix_hash);
  eosio::check(appendix.has_value(), "Приложение не найдено");
  eosio::check(appendix->status == Capital::Appendix::Status::CREATED, "Приложение уже обработано");
  
  auto contributor = Capital::Contributors::get_contributor(coopname, appendix->username);
  eosio::check(contributor.has_value(), "Контрибьютор с основным договором УХД не найден");
  
  // Получаем проект ДО модификаций
  auto project = Capital::Projects::get_project_or_fail(coopname, appendix->project_hash);
  
  // Проверяем родительский сегмент ДО модификаций
  bool should_add_as_author = false;
  if (project.parent_hash != checksum256()) {
    auto parent_segment = Capital::Segments::get_segment(coopname, project.parent_hash, appendix->username);
    should_add_as_author = parent_segment.has_value() && parent_segment->is_author;
  }
  
  // === ВСЕ МОДИФИКАЦИИ ПОСЛЕ ВСЕХ ЧТЕНИЙ ===
  
  // Добавляем проект в вектор appendixes у контрибьютора
  Capital::Contributors::push_appendix_to_contributor(coopname, contributor->id, appendix->project_hash);
  
  // Автоматически добавляем пользователя в соавторы, если он является соавтором родительского проекта
  if (should_add_as_author) {
    // Получаем или создаем segment_id для автора
    auto segment = Capital::Segments::get_segment(coopname, appendix->project_hash, appendix->username);
    uint64_t segment_id = 0;
    if (segment.has_value()) {
      segment_id = segment.value().id;
    } else {
      segment_id = Capital::Segments::get_segment_id(coopname);
    }
    
    Capital::Core::upsert_author_segment(coopname, segment_id, project, appendix->username);
  }

  // Фиксируем документ в реестре как принятый
  Soviet::make_complete_document(_capital, coopname, appendix->username, Names::Capital::APPROVE_APPENDIX, appendix_hash, approved_document);

  // Авторегистрация доли по программе «Благорост» при допуске к проекту:
  // если у пайщика уже есть баланс w.cap.blago — сразу заводим сегмент с
  // user_shares = available + blocked. Без баланса regshare не вызываем —
  // сегмент создастся при ближайшем тике scheduler'а, как только появится
  // первая инвестиция в программу.
  const auto user_shares =
    Capital::Core::get_capital_program_user_share_balance(coopname, appendix->username);
  if (user_shares.amount > 0) {
    eosio::action(
      eosio::permission_level{_capital, "active"_n},
      _capital,
      "regshare"_n,
      std::make_tuple(coopname, appendix->project_hash, appendix->username, user_shares)
    ).send();
  }

  // Удаляем приложение
  Capital::Appendix::delete_appendix(coopname, appendix->id);
}