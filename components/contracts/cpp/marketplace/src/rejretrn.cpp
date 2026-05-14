/**
 * @brief Председатель отказывает в гарантийном возврате на очном осмотре (Story 7.3, p.mkt.return).
 *
 * Финальное решение, без ledger2-операций. Статус: approved_for_visit → rejected_at_ku.
 * reason сохраняется в return_request.reason_visit для UI заказчика.
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == approved_for_visit.
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 5): полная реализация.
 */
void marketplace::rejretrn(eosio::name coopname,
                            eosio::name chairman,
                            checksum256 request_hash,
                            std::string reason,
                            document2 decision) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 5: rejretrn ещё не реализован");
}
