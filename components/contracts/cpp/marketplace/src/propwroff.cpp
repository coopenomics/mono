/**
 * @brief Backend / админ выносит проект списания скоропорта (Story 8.1, p.mkt.wroff).
 *
 * Без ledger2-операций. Создаётся writeoff_proposal в статусе proposed (= "draft" в YAML);
 * total_amount = Σ items.amount.
 *
 * Guards:
 *  - actor backend (auth coopname).
 *  - items.size() > 0.
 *  - Все items.amount > 0 в _root_govern_symbol.
 *  - proposal_hash уникален.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::propwroff(eosio::name coopname,
                             eosio::name proposed_by,
                             checksum256 proposal_hash,
                             std::vector<wroff_item> items) {
  require_auth(coopname);

  eosio::check(!items.empty(), "propwroff: список items пуст");
  eosio::check(!Marketplace::get_writeoff_proposal_by_hash(coopname, proposal_hash).has_value(),
               "propwroff: проект списания с таким hash уже существует");

  eosio::asset total = eosio::asset(0, _root_govern_symbol);
  for (const auto& item : items) {
    eosio::check(item.amount.is_valid() && item.amount.amount > 0,
                 "propwroff: каждая позиция должна иметь положительную сумму");
    eosio::check(item.amount.symbol == _root_govern_symbol,
                 "propwroff: некорректный символ валюты позиции");
    total += item.amount;
  }

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  writeoff_proposals_index proposals(_marketplace, coopname.value);
  proposals.emplace(_marketplace, [&](auto& p) {
    p.id            = proposals.available_primary_key();
    p.hash          = proposal_hash;
    p.coopname      = coopname;
    p.proposed_by   = proposed_by;
    p.items         = items;
    p.total_amount  = total;
    p.status        = WroffStatus::PROPOSED;
    p.proposed_at   = now;
  });
}
