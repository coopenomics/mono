/**
 * @brief Backend исполняет одну позицию авторизованного советом проекта
 * списания скоропорта (Story 8.4, p.mkt.wroff).
 *
 * Per-item операция:
 *  - Ledger2::apply(o.mkt.wroff, item.amount, …, hash=proposal.hash) — Дт 86 / Кт 10
 *    (списание со склада через целевое финансирование).
 *
 * Вызывается ТОЛЬКО после того, как совет авторизовал проект (status =
 * AUTHORIZED через callback `onmktwoauth`). Backend проходит циклом по
 * неисполненным позициям, вызывая `execwroff(proposal_hash, item_index)`
 * per item — это снимает ограничение на максимальный размер протокола.
 *
 * Исполнение последней позиции (все items[i].executed == true) — терминал
 * жизненного цикла: запись проекта стирается из RAM, история — в журнале
 * действий и решении совета.
 *
 * Подписанный советом protocol уже лежит в `proposal.protocol` (положен
 * callback'ом `onmktwoauth`), отдельно его передавать не нужно.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::execwroff(eosio::name coopname,
                             eosio::name signer,
                             checksum256 proposal_hash,
                             uint64_t item_index) {
  require_auth(coopname);

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, proposal_hash);
  eosio::check(p.status == WroffStatus::AUTHORIZED,
               "Проект списания не авторизован советом");
  eosio::check(item_index < p.items.size(),
               "Указана несуществующая позиция в проекте списания");
  eosio::check(!p.items[item_index].executed,
               "Эта позиция проекта списания уже исполнена");

  const auto& item = p.items[item_index];

  auto branch = get_branch_or_fail(coopname, item.braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен исполнять списание данного кооперативного участка");

  // o.mkt.wroff: Дт 86 / Кт 10
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::WRITE_OFF_PERISHABLE,
                 processes::marketplace::WRITEOFF,
                 item.amount, item.braname, p.hash,
                 Marketplace::Memo::get_writeoff_memo(p.id, item_index));

  // Последняя позиция закрывает проект: запись стирается из RAM. Иначе —
  // помечаем позицию исполненной (рабочее состояние частичного исполнения).
  bool all_done = true;
  for (uint64_t i = 0; i < p.items.size(); ++i) {
    if (i != item_index && !p.items[i].executed) { all_done = false; break; }
  }

  if (all_done) {
    Marketplace::erase_writeoff_proposal(coopname, p.id);
  } else {
    Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
      upd.items[item_index].executed = true;
      upd.decided_by = signer;
    });
  }
}
