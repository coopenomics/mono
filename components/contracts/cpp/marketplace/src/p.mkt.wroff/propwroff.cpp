/**
 * @brief Backend выносит проект списания скоропорта на повестку совета
 * (Story 8.1, p.mkt.wroff).
 *
 * Без ledger2-операций. Создаётся writeoff_proposal в статусе proposed;
 * total_amount = Σ items.amount; все items создаются с executed=false.
 * Сразу после этого action'а backend в той же транзакции вызывает
 * `soviet::createagenda(type=mktwroff, callback_contract=_marketplace,
 * confirm_callback=onmktwoauth, decline_callback=onmktwodecl, hash=
 * proposal_hash, statement=signed_writeoff_statement)`. Списание
 * выполняется per-item через `execwroff` только после callback'а
 * `onmktwoauth` (status proposed → authorized).
 *
 * Guards:
 *  - actor backend (auth coopname).
 *  - items.size() > 0.
 *  - Все items.amount > 0 в _root_govern_symbol.
 *  - Все items.braname существуют в `branches[coopname]`.
 *  - proposal_hash уникален.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::propwroff(eosio::name coopname,
                             eosio::name proposed_by,
                             checksum256 proposal_hash,
                             std::vector<wroff_item> items) {
  require_auth(coopname);

  eosio::check(!items.empty(), "Список позиций к списанию пуст");
  eosio::check(!Marketplace::get_writeoff_proposal_by_hash(coopname, proposal_hash).has_value(),
               "Проект списания с таким идентификатором уже создан");

  eosio::asset total = eosio::asset(0, _root_govern_symbol);
  for (auto& item : items) {
    eosio::check(item.amount.is_valid() && item.amount.amount > 0,
                 "Каждая позиция должна иметь положительную сумму");
    eosio::check(item.amount.symbol == _root_govern_symbol,
                 "Некорректный символ валюты в позиции списания");
    // КУ-источник существует
    get_branch_or_fail(coopname, item.braname);
    item.executed = false;  // защита от случайно проставленного флага
    total += item.amount;
  }

  writeoff_proposals_index proposals(_marketplace, coopname.value);
  proposals.emplace(_marketplace, [&](auto& p) {
    p.id            = proposals.available_primary_key();
    p.hash          = proposal_hash;
    p.coopname      = coopname;
    p.proposed_by   = proposed_by;
    p.items         = items;
    p.total_amount  = total;
    p.status        = WroffStatus::PROPOSED;
  });
}
