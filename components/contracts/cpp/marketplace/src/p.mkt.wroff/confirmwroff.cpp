/**
 * @brief Председатель кооперативного участка подтверждает фактическое
 * списание со склада своего КУ по авторизованному советом проекту
 * (ручной шаг стола ПВЗ, p.mkt.wroff).
 *
 * Совет своим решением (proposed → authorized через `onmktwoauth`) лишь
 * признаёт списание допустимым. Имущество физически выбывает со склада
 * только после того, как ответственный за склад председатель КУ подпишет
 * Служебную записку о списании (registry 1111) — это и делает данный action.
 *
 * Гранулярность — по одному КУ (`braname`) за вызов: проект списания может
 * охватывать несколько участков, и каждый председатель закрывает только
 * свою часть. Все неисполненные позиции данного КУ списываются в одной
 * транзакции (Ledger2::apply o.mkt.wroff, Дт 86 / Кт 10 — как в `execwroff`).
 * Служебная записка публикуется в реестр документов в пакете процесса
 * списания (package = proposal_hash). Исполнение последней позиции проекта
 * (по всем КУ) стирает запись из RAM — терминал жизненного цикла.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::confirmwroff(eosio::name coopname,
                               eosio::name signer,
                               checksum256 proposal_hash,
                               eosio::name braname,
                               document2 memo) {
  require_auth(coopname);

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, proposal_hash);
  eosio::check(p.status == WroffStatus::AUTHORIZED,
               "Проект списания не авторизован советом");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен подтверждать списание данного кооперативного участка");

  // Списываем все неисполненные позиции этого КУ. По каждой — o.mkt.wroff
  // (Дт 86 / Кт 10), как в execwroff; per-item, чтобы привязать memo к
  // конкретной позиции в журнале действий.
  uint64_t confirmed_count = 0;
  for (uint64_t i = 0; i < p.items.size(); ++i) {
    const auto& item = p.items[i];
    if (item.executed || item.braname != braname) continue;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::WRITE_OFF_PERISHABLE,
                   item.amount, item.braname, p.hash,
                   Marketplace::Memo::get_writeoff_memo(p.id, i));
    confirmed_count++;
  }
  eosio::check(confirmed_count > 0,
               "Нет неисполненных позиций данного кооперативного участка в проекте списания");

  // Служебная записка о списании (1111) — в реестр документов, пакет
  // процесса списания (package = proposal_hash), рядом с Заявлением и
  // Протоколом совета.
  Soviet::make_complete_document(_marketplace, coopname, signer,
                                 "confirmwroff"_n, proposal_hash, memo);

  // Помечаем позиции КУ исполненными; если после этого исполнены все
  // позиции проекта (по всем КУ) — стираем запись из RAM.
  bool all_done = true;
  for (const auto& item : p.items) {
    if (item.executed) continue;
    if (item.braname == braname) continue;  // эти только что списали
    all_done = false;
    break;
  }

  if (all_done) {
    Marketplace::erase_writeoff_proposal(coopname, p.id);
  } else {
    Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
      for (auto& it : upd.items) {
        if (!it.executed && it.braname == braname) it.executed = true;
      }
      upd.decided_by = signer;
    });
  }
}
