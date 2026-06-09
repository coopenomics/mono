/**
 * Callback совета при одобрении заявки на инвестирование средств
 * кооператива в ЦПП оператора платформы: фиксирует решение и создаёт
 * исходящий платёж в gateway для оплаты кассиром по реквизитам оператора.
 */
void wallet::authinv(AUTHINV_SIGNATURE) {
  require_auth(_soviet);

  auto exist_investment = Wallet::get_investment(coopname, hash);
  eosio::check(exist_investment.has_value(), "Объект инвестирования с указанным хэшем не найден");

  Wallet::investments_index investments(_wallet, coopname.value);

  auto investment = investments.find(exist_investment -> id);
  eosio::check(investment != investments.end(), "Объект процессинга не найден");

  investments.modify(investment, _soviet, [&](auto &d){
    d.status = "authorized"_n;
    d.authorization = authorization;
  });

  // создаём объект исходящего платежа в gateway с коллбэком после обработки
  Action::send<createoutpay_interface>(
    _gateway,
    "createoutpay"_n,
    _wallet,
    coopname,
    coopname,
    hash,
    investment -> quantity,
    _wallet,
    Wallet::get_valid_wallet_action("completeinv"_n),
    Wallet::get_valid_wallet_action("declineinv"_n)
  );
}
