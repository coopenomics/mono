/**
 * @brief Списание членского взноса ученика в фонд ЦПП «Образование».
 *
 * Положение ЦПП (п. 4.2.2): при подключении подписки её стоимость переходит с
 * паевого на кошелёк программы с конвертацией в членский взнос и списывается
 * в распоряжение Общества. Первая половина — `convert` (o.edu.conv), вторая —
 * это действие: собранный взнос уходит в фонд программы, откуда кооператив
 * ведёт расходы на обучение и возвраты по Положению.
 *
 * Одна ledger2-операция:
 *  - `o.edu.fee` (TRANSFER w.edu.member → w.edu.fund, без проводки — оба на
 *    счёте 86). Зеркало `o.mkt.fee` «Стола заказов».
 *
 * Guards:
 *  - amount > 0 в символе кооператива;
 *  - подписка с указанным hash существует;
 *  - взнос списывается у владельца подписки;
 *  - w.edu.member.available пайщика >= amount.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::chargefee(eosio::name coopname,
                          eosio::name username,
                          checksum256 sub_hash,
                          eosio::asset amount) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма членского взноса");

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto sub = Edubridge::get_subscription_or_fail(subs, sub_hash);
  eosio::check(sub->username == username,
               "Членский взнос списывается у владельца подписки");

  auto bal_member = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::EDU_MEMBER_FEE, username);
  eosio::check(bal_member.available >= amount,
               std::string{"Недостаточно членских средств программы: требуется "} +
                 amount.to_string() + ", доступно " + bal_member.available.to_string());

  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::COLLECT_EDU_FEE,
                 processes::edubridge::ACCESS,
                 amount, username, sub_hash,
                 Edubridge::Memo::get_collect_fee_memo());
}
