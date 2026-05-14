/**
 * @brief Председатель открывает выдачу первой подписью АПП-выдачи (Story 6.1, signiss1).
 *
 * Без ledger2-операций. Per-Order: статус accepted_to_coop → ready_to_receive;
 * issue_act_signiss1 сохраняется; ready_at = now(); нотификация заказчику
 * (через notifications-port в backend post-effect).
 *
 * Guards (L1):
 *  - actor == order.ku_chairman.
 *  - Order в accepted_to_coop.
 *  - verify_document_or_fail(act, {chairman}).
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::signiss1(eosio::name coopname,
                            eosio::name chairman,
                            checksum256 order_hash,
                            document2 act) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: signiss1 ещё не реализован");
}
