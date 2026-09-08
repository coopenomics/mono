/**
 * @brief Обратный вызов от `soviet::exec` после утверждения Протокола решения
 * совета об отмене сделки по гарантийному возврату (registry 1117) — паевая
 * модель (компонент 68, задачи 99D-9 / 99D-12). Совет легитимизировал решение
 * оператора участка (заявление 1116): сделка по возврату паевого взноса
 * имуществом отменяется в части принятого имущества. Сигнатура `(coopname,
 * hash, authorization)` — `AUTHORIZE_CALLBACK_SIGNATURE`; единственно
 * допустимая авторизация — `_soviet`.
 *
 * Обратные операции к выдаче одной транзакцией:
 *  - o.mkt.return на fact_cost заявки: ISSUE w.mkt.share, Дт 10 / Кт 80 —
 *    паевой взнос за возвращённое восстановлен на свободном паевом «Стола
 *    заказов», имущество на складе участка; compensating forward к
 *    o.mkt.consum, исходные записи журнала не меняются;
 *  - членский взнос участка за возвращённое: branch::retfee (общий кошелёк
 *    участка → пул взносов) и o.mkt.refund (пул → членский кошелёк программы
 *    w.mkt.member, без проводки — членский остаётся членским).
 *  - `newresolved` для рекламации пайщика (1106) в пакет документов заказа;
 *    заявление оператора и протокол публикует контракт soviet пакетом
 *    повестки; запись заявки стирается.
 *  - по заказу с внешним поставщиком (offerer != coopname) заводится
 *    гарантийная претензия поставщику (таблица claims, процесс p.mkt.claim,
 *    hash = sha256(байты хэша рекламации + "claim") — своя нитка, чтобы в
 *    реестре процессов претензия не сливалась с ниткой возврата) с
 *    рекламацией в две подписи и суммой возврата;
 *    o.mkt.claim (ISSUE w.mkt.claim по поставщику, без проводки) — задача
 *    99D-13. Ответ поставщика — admitclaim / refuseclaim. order.return_request_id не сбрасывается — повторный возврат по
 *    тому же заказу не открывается.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktrtauth(eosio::name coopname,
                               checksum256 hash,
                               document2 authorization) {
  require_auth(_soviet);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, hash);
  eosio::check(r.status == ReturnStatus::RETURN_PENDING,
               "Заявка на возврат не ожидает решения совета (обратный вызов повторный или поздний)");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, r.original_order_hash);
  const eosio::name braname = o.delivery_braname;

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RETURN_BY_MEMBER,
                 processes::marketplace::RETURN,
                 r.fact_cost, r.orderer, r.hash,
                 Marketplace::Memo::get_return_by_member_memo(r.id, r.original_order_id));

  const eosio::asset fee_refund = r.fee_refund;
  if (fee_refund.amount > 0) {
    Branch::retfee(_marketplace, coopname, braname, fee_refund,
                   processes::marketplace::RETURN, r.hash,
                   Marketplace::Memo::get_return_fee_from_common_memo(r.id, r.original_order_id));
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::MEMBERSHIP_FEE_REFUND,
                   processes::marketplace::RETURN,
                   fee_refund, r.orderer, r.hash,
                   Marketplace::Memo::get_return_fee_to_member_memo(r.id, r.original_order_id));
  }

  Action::send<newresolved_interface>(_soviet, "newresolved"_n, _marketplace,
                                      coopname, r.orderer, "onmktrtauth"_n,
                                      r.original_order_hash, r.statement);

  // Претензия поставщику: имущество оплачено поставщику, а вернулось на склад.
  // Заказ из остатка кооператива (offerer == coopname) поставщика не имеет.
  if (o.offerer != coopname && r.fact_cost.amount > 0) {
    Marketplace::warranty_claims_index claims(_marketplace, coopname.value);
    // Хэш претензии выводится из хэша рекламации детерминированно (бэкенд
    // считает так же): sha256(32 байта хэша рекламации ‖ "claim").
    const auto hash_bytes = r.hash.extract_as_byte_array();
    std::string seed(reinterpret_cast<const char*>(hash_bytes.data()), hash_bytes.size());
    seed += "claim";
    const checksum256 claim_hash = eosio::sha256(seed.data(), seed.size());
    eosio::check(!Marketplace::get_claim_by_hash(coopname, claim_hash).has_value(),
                 "Претензия поставщику по этой рекламации уже выставлена");
    const uint64_t claim_id = claims.available_primary_key();
    const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    claims.emplace(_marketplace, [&](auto& c) {
      c.id                  = claim_id;
      c.hash                = claim_hash;
      c.coopname            = coopname;
      c.supplier            = o.offerer;
      c.orderer             = r.orderer;
      c.original_order_id   = r.original_order_id;
      c.original_order_hash = r.original_order_hash;
      c.actual_quantity     = r.actual_quantity;
      c.amount              = r.fact_cost;
      c.reason_text         = r.reason_text;
      c.photos              = r.photos;
      c.reclamation         = r.statement;
      c.status              = ClaimStatus::PENDING;
      c.created_at          = now;
    });
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::CLAIM_SUPPLIER,
                   processes::marketplace::CLAIM,
                   r.fact_cost, o.offerer, claim_hash,
                   Marketplace::Memo::get_claim_supplier_memo(claim_id, r.original_order_id));
  }

  Marketplace::erase_return_request(coopname, r.id);
}
