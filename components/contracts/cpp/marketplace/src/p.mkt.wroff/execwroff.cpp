/**
 * @brief Совет исполняет одну позицию проекта списания скоропорта (Story 8.3,
 * p.mkt.wroff).
 *
 * Per-item композитная транзакция (атомарно):
 *  - Ledger2::apply(o.mkt.wroff,  item.amount, …, hash=proposal.hash) — Дт 91 / Кт 10.
 *  - Ledger2::apply(o.mkt.wroff2, item.amount, …, hash=proposal.hash) — Дт 86 / Кт 91.
 *
 * Backend проходит циклом по неисполненным позициям protocols proposal'а,
 * вызывая `execwroff(proposal_hash, item_index, protocol)` per item — это
 * снимает ограничение на максимальный размер протокола (тысячи позиций
 * не помещаются в одну транзакцию Antelope).
 *
 * Все операции с одним process_hash = proposal.hash — backend через
 * `getProcess(proposal.hash)` соберёт полную трассировку процесса.
 *
 * Status: PROPOSED → EXECUTED наступает автоматически после исполнения
 * последней позиции (когда все items[i].executed становятся true).
 *
 * Guards:
 *  - proposal.status == PROPOSED.
 *  - item_index в пределах proposal.items.
 *  - items[item_index].executed == false (idempotency).
 *  - Подписант (`signer`) авторизован для КУ-источника списания
 *    (`items[item_index].braname`) — председатель / trustee / trusted.
 *  - verify_document_or_fail(protocol, {signer}) — sanity check на подпись;
 *    реальная сверка с протоколом совета — backend pre-validation через
 *    soviet::decisions.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::execwroff(eosio::name coopname,
                             eosio::name signer,
                             checksum256 proposal_hash,
                             uint64_t item_index,
                             document2 protocol) {
  require_auth(coopname);

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, proposal_hash);
  eosio::check(p.status == WroffStatus::PROPOSED,
               "Проект списания не находится на исполнении");
  eosio::check(item_index < p.items.size(),
               "Указана несуществующая позиция в проекте списания");
  eosio::check(!p.items[item_index].executed,
               "Эта позиция проекта списания уже исполнена");

  const auto& item = p.items[item_index];

  auto branch = get_branch_or_fail(coopname, item.braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен исполнять списание данного кооперативного участка");

  verify_document_or_fail(protocol, { signer });

  // Композитная пара wroff + wroff2 для одной позиции
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::WRITE_OFF_PERISHABLE,
                 item.amount, item.braname, p.hash,
                 Marketplace::Memo::get_writeoff_memo(p.id, item_index));
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::WRITE_OFF_TRANSIT_CLOSE,
                 item.amount, item.braname, p.hash,
                 Marketplace::Memo::get_writeoff_transit_close_memo(p.id, item_index));

  // Помечаем позицию исполненной + финализируем proposal если все позиции готовы
  Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
    upd.items[item_index].executed = true;
    upd.protocol = protocol;
    upd.decided_by = signer;

    bool all_done = true;
    for (const auto& it : upd.items) {
      if (!it.executed) { all_done = false; break; }
    }
    if (all_done) {
      upd.status = WroffStatus::EXECUTED;
    }
  });
}
