/**
 * @brief Решение совета о выводе средств из фонда — прежний путь, отключён
 * (задача 99D-25, решение владельца 03.11.2026).
 *
 * Остатки фондов ведёт ledger2 на кошельках фондов; вывод из фондов через
 * заявки контракта fund больше не существует, поэтому и решение совета по ним
 * не заводится. Сигнатура действия сохранена: прежний вызов получает отказ с
 * кодом, а не ошибку ABI. Вывод средств из фондов через ledger2 — отдельная
 * задача.
 *
 * @ingroup public_actions
 * @ingroup public_soviet_actions
 * @note Авторизация требуется от аккаунта: @p _fund
 */
void soviet::fundwithdraw(eosio::name coopname, eosio::name username, eosio::name type, uint64_t withdraw_id, document2 document) {
  require_auth(_fund);
  (void)coopname; (void)username; (void)type; (void)withdraw_id; (void)document;
  eosio::check(false,
               "FUND_DEPRECATED: Вывод из фондов по заявкам контракта fund отключён — остатки фондов ведёт ledger2 на кошельках фондов");
}
