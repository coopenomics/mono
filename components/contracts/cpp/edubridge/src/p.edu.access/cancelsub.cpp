/**
 * @brief Отмена подписки на курс с возвратом членского взноса.
 *
 * Положение ЦПП «Образование» знает три основания вернуть взнос ученику:
 * отмена до активации курса (полная стоимость), отмена по недобору, когда
 * кооператив не открыл группу (полная стоимость, сразу на паевой), и отказ в
 * ходе подписки (половина остаточной стоимости за вычетом использованного).
 * Сумму возврата считает кооператив по Положению; контракт проводит её и
 * закрывает подписку.
 *
 * Движения средств:
 *  - `o.edu.refund` (TRANSFER w.edu.fund → w.edu.member, без проводки — оба на
 *    86): взнос возвращается из фонда программы на кошелёк ЦПП ученика;
 *  - `o.edu.retshr` (TRANSFER w.edu.member → w.wal.share, Дт 86 / Кт 80) —
 *    только при `to_share`: возврат по недобору идёт на паевой сразу, потому
 *    что отменяет решение кооператива, а не выбор ученика.
 *
 * Нулевой возврат допустим: отказ после последнего занятия возвращает ноль,
 * подписка при этом всё равно закрывается.
 *
 * Guards:
 *  - подписка с указанным hash существует и принадлежит этому пайщику;
 *  - сумма возврата неотрицательна и в символе кооператива;
 *  - достаточность средств проверяет сам перевод в книге учёта.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::cancelsub(eosio::name coopname,
                          eosio::name username,
                          checksum256 sub_hash,
                          eosio::asset refund,
                          bool to_share) {
  require_auth(coopname);

  eosio::check(refund.is_valid() && refund.amount >= 0,
               "Сумма возврата не может быть отрицательной");
  eosio::check(refund.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме возврата");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "Подписку отменяет тот пайщик, которому она принадлежит");

  if (refund.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::REFUND_FEE,
                   processes::edubridge::ACCESS,
                   refund, username, sub_hash,
                   Edubridge::Memo::get_refund_memo());

    if (to_share) {
      Ledger2::apply(_edubridge, coopname,
                     operations::edubridge::RETURN_TO_SHARE,
                     processes::edubridge::ACCESS,
                     refund, username, sub_hash,
                     Edubridge::Memo::get_return_to_share_memo());
    }
  }

  subs.erase(sub);
}
