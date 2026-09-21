/**
 * @brief Прекращение участия пайщика в ЦПП «Образование».
 *
 * Членский взнос программы возвращается в паевой только с прекращением участия
 * в программе: по заявлению пайщика, при его выходе из кооператива и при отмене
 * курса по недобору. Частичного перевода в паевой нет — пока пайщик участвует в
 * программе, остаток его кошелька программы идёт только на новые подписки.
 *
 * Основание — заявление об аннулировании соглашения об участии в программе
 * (тот же бланк, что при выходе из кооператива, без выхода и с одной этой
 * программой в таблице). Пайщик подписывает его, кооператив согласует и до
 * этого действия закрывает все подписки пайщика с возвратом по Положению.
 * Здесь остаток кошелька программы целиком уходит в паевой, а соглашение об
 * участии в программе аннулируется. Чтобы снова учиться, пайщик подписывает
 * оферту программы заново.
 *
 * Одна ledger2-операция (при ненулевом остатке):
 *  - `o.edu.retshr` (TRANSFER w.edu.member → w.wal.share, Дт 86 / Кт 80) —
 *    инверсия `o.edu.conv`.
 * Inline `wallet::revokeagree` — соглашение о программе «Обучение» снято.
 *
 * Guards:
 *  - заявление подписано пайщиком его ключом; пайщик — действующий член;
 *  - действующих подписок у пайщика нет;
 *  - сумма равна всему остатку w.edu.member, ноль допустим.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::retshare(eosio::name coopname,
                         eosio::name username,
                         eosio::asset amount,
                         document2 statement) {
  require_auth(coopname);

  eosio::check(amount.is_valid() && amount.amount >= 0 && amount.symbol == _root_govern_symbol,
               "Сумма перевода в паевой указывается в символе кооператива и не отрицательна");
  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление об аннулировании соглашения об участии в программе");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);

  edu_subscriptions_index subs(_edubridge, coopname.value);
  auto by_user = subs.get_index<"byusername"_n>();
  eosio::check(by_user.find(username.value) == by_user.end(),
               "У пайщика есть действующие подписки: сначала они закрываются с возвратом по Положению");

  auto bal_member = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::EDU_MEMBER_FEE, username);
  eosio::check(bal_member.available == amount,
               std::string{"В паевой переводится весь остаток кошелька программы: на кошельке "} +
                 bal_member.available.to_string() + ", указано " + amount.to_string());

  if (amount.amount > 0) {
    Ledger2::apply(_edubridge, coopname,
                   operations::edubridge::RETURN_TO_SHARE,
                   processes::edubridge::ACCESS,
                   amount, username, statement.hash,
                   Edubridge::Memo::get_return_to_share_memo());
  }

  if (has_signed_program_agreement(coopname, username, _eduparent_program_id)) {
    eosio::action(
      eosio::permission_level{_edubridge, "active"_n},
      _wallet,
      "revokeagree"_n,
      std::make_tuple(coopname, username, _eduparent_program_id)
    ).send();
  }

  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "retshare"_n,
                                 statement.hash, statement);
}
