/**
 * @brief Председатель принимает гарантийный возврат на очном осмотре (Story 7.4, p.mkt.return).
 *
 *  - Ledger2::apply(o.mkt.return, fact_cost, orderer, hash=request.hash)
 *    — ISSUE w.mkt.member, Дт 10 / Кт 86. Восстановление средств на членском
 *    «Стола заказов» заказчика и возврат имущества на склад через целевое финансирование.
 *
 * Compensating forward, не revert (Locked Decision L3 — AR14): новое событие в
 * journal с прикладным полем `original_consume_op_id` (заполняется backend'ом
 * в submretrn) для трассировки. Исходная o.mkt.consum в журнале НЕ модифицируется.
 *
 * Терминал жизненного цикла: запись заявления стирается из RAM, история
 * (включая со-подписанное заявление) остаётся в журнале действий. Имущество
 * возвращается на склад КУ; средства восстанавливаются на
 * w.mkt.member.available заказчика.
 *
 * Принятие возврата оформляется второй подписью председателя на заявлении
 * пайщика (канон двухподписных актов): на вход приходит тот же документ
 * заявления (registry 1104) с двумя подписями — пайщика и председателя; обе
 * проверяются, поле `statement` перезаписывается со-подписанной версией.
 * Отдельного документа решения нет.
 *
 * Guards:
 *  - Указанный КУ (`braname`) — участок выдачи исходного заказа.
 *  - Подписант (`signer`) авторизован для указанного КУ (`braname`).
 *  - return_request.status == approved_for_visit.
 *  - statement подписан пайщиком (orderer) и председателем (signer).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::accretrn(eosio::name coopname,
                            eosio::name signer,
                            eosio::name braname,
                            checksum256 request_hash,
                            document2 statement) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "Заявление не одобрено для очного осмотра");

  Marketplace::check_return_request_branch(coopname, r, braname);

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать возвраты данного кооперативного участка");

  // Председатель накладывает вторую подпись на заявление пайщика — документ
  // должен нести обе подписи (пайщика и председателя).
  eosio::check(!is_empty_document(statement),
               "Принятие возврата требует подписанного председателем заявления");
  verify_document_or_fail(statement, { r.orderer, signer });

  // o.mkt.return: ISSUE w.mkt.member, Дт 10 / Кт 86
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::RETURN_BY_MEMBER,
                 processes::marketplace::RETURN,
                 r.fact_cost, r.orderer, r.hash,
                 Marketplace::Memo::get_return_by_member_memo(r.id, r.original_order_id));

  // Возврат членского взноса, уплаченного за возвращаемое имущество: пайщик
  // получает обратно полную сумму заказа, а не только стоимость имущества.
  //
  // Взнос ушёл в общий кошелёк участка на выдаче (o.brn.common), поэтому
  // возвращается тем же путём в обратную сторону, двумя ногами внутри счёта 86
  // (новых бухгалтерских проводок нет — деньги не покидают целевое
  // финансирование, а перекладываются обратно между кошельками):
  //   1) o.brn.retfee  — общий кошелёк участка → пул взносов «Стола заказов»;
  //   2) o.mkt.refund  — пул взносов → членский кошелёк заказчика.
  // Прямой перевод между кошельком участка и кошельком пайщика невозможен:
  // walletop держит один username на обе стороны, отсюда транзит через пул.
  //
  // Порядок важен: инлайн-действия исполняются в порядке отправки, поэтому
  // сперва отправляем пополнение пула участком и только затем списание из него.
  // Если участок уже распределил или потратил взнос, branch::retfee остановит
  // приём возврата человекочитаемой ошибкой — сначала пополнение общего кошелька.
  const eosio::asset fee_refund = r.fee_refund;

  if (fee_refund.amount > 0) {
    Branch::retfee(_marketplace, coopname, braname, fee_refund,
                   processes::marketplace::RETURN, r.hash,
                   Marketplace::Memo::get_return_fee_from_common_memo(r.id, r.original_order_id));

    // Имя нитки — возврат, а не поставка: обе ноги идут по хэшу заявки на
    // возврат. В реестре операций o.mkt.refund объявлен под поставкой (там он
    // возвращает неиспользованный взнос по заказу), но здесь он вторая нога
    // гарантийного возврата — нитку называет её инициатор.
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::MEMBERSHIP_FEE_REFUND,
                   processes::marketplace::RETURN,
                   fee_refund, r.orderer, r.hash,
                   Marketplace::Memo::get_return_fee_to_member_memo(r.id, r.original_order_id));
  }

  // Со-подписанное заявление доводит запись реестра документов до «решён»
  // (тот же doc_hash, что у newsubmitted в submretrn; новая версия с двумя
  // подписями) в пакете процесса заказа (package = order_hash).
  Action::send<newresolved_interface>(_soviet, "newresolved"_n, _marketplace,
                                      coopname, r.orderer, "accretrn"_n,
                                      r.original_order_hash, statement);

  Marketplace::erase_return_request(coopname, r.id);
}
