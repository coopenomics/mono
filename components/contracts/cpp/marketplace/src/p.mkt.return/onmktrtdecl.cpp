/**
 * @brief Обратный вызов от `soviet` после отказа совета в принятии имущества
 * или истечения срока повестки — гарантийный возврат в паевой модели
 * (компонент 68). Сигнатура `(coopname, hash, reason)` —
 * `DECLINE_CALLBACK_SIGNATURE`; единственно допустимая авторизация — `_soviet`.
 *
 * Эффект: `retpend → retdecl`. Имущество остаётся на участке и ждёт
 * заказчика; баланс не меняется. Заявку закрывает оператор действием
 * `handback`, выдав имущество обратно.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktrtdecl(eosio::name coopname,
                               checksum256 hash,
                               std::string reason) {
  require_auth(_soviet);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, hash);
  eosio::check(r.status == ReturnStatus::RETURN_PENDING,
               "Заявка на возврат не ожидает решения совета (обратный вызов повторный или поздний)");

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status = ReturnStatus::RETURN_DECLINED;
  });
}
