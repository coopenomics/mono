/**
 * @brief Выносит проект списания скоропорта на повестку совета
 * (Story 8.1, p.mkt.wroff).
 *
 * Без ledger2-операций. Создаётся writeoff_proposal в статусе proposed;
 * total_amount = Σ items.amount; все items создаются с executed=false. Тем же
 * action'ом контракт ставит повестку: inline-вызов `soviet::createagenda`
 * от `permission_level{_marketplace, active}` (marketplace в contracts_whitelist)
 * с `type=mktwroff`, `hash=proposal_hash`, `callback_contract=_marketplace`,
 * `confirm_callback=onmktwoauth`, `decline_callback=onmktwodecl`,
 * `statement` (подписанное Заявление 1106). Мост повестки целиком на контракте —
 * backend не подписывает createagenda отдельно (кооператив не в whitelist).
 * Списание выполняется per-item через `execwroff` только после callback'а
 * `onmktwoauth` (status proposed → authorized).
 *
 * Guards:
 *  - actor coopname (require_auth).
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
                             std::vector<wroff_item> items,
                             document2 statement,
                             std::string meta) {
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

  // Мост повестки совета: marketplace в contracts_whitelist, поэтому
  // createagenda авторизуется от permission_level{_marketplace, active}.
  // hash=proposal_hash, чтобы callback onmktwoauth/onmktwodecl нашёл проект.
  action(permission_level{_marketplace, "active"_n}, _soviet, "createagenda"_n,
    std::make_tuple(
      coopname,
      proposed_by,
      get_valid_soviet_action(_marketplace_writeoff_action),
      proposal_hash,
      _marketplace,
      "onmktwoauth"_n,
      "onmktwodecl"_n,
      statement,
      meta
    )
  ).send();
}
