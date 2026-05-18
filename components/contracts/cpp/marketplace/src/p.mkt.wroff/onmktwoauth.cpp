/**
 * @brief Callback от `soviet::exec` после авторизации Протокола совета о
 * списании скоропорта (registry 1105) председателем (Story 8.4, p.mkt.wroff).
 *
 * Соглашение о сигнатуре — `(coopname, hash, authorization)` — задано в
 * `soviet::createagenda::authorize_action_effect`. Контракт `soviet` зовёт
 * `marketplace::onmktwoauth` от своего имени, поэтому единственно допустимая
 * авторизация — `_soviet`.
 *
 * Эффект:
 *  - Находит wroffprops по proposal_hash == `hash`.
 *  - Проверяет, что текущий статус == PROPOSED (запрет повторного callback'а).
 *  - Записывает подписанный советом protocol2 в `proposal.protocol`.
 *  - Переводит статус PROPOSED → AUTHORIZED.
 *
 * Дальнейший шаг — backend через дельту/мониторинг видит AUTHORIZED и
 * проходит циклом execwroff per-item (см. `execwroff.cpp`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktwoauth(eosio::name coopname,
                               checksum256 hash,
                               document2 authorization) {
  require_auth(_soviet);

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, hash);
  eosio::check(p.status == WroffStatus::PROPOSED,
               "Проект списания не находится на повестке (callback повторный или поздний)");

  Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
    upd.status   = WroffStatus::AUTHORIZED;
    upd.protocol = authorization;
  });
}
