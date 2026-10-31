/**
 * @brief Списание обеспечительной части паевого взноса в членский взнос
 * кооперативного участка по условиям ЦПП «Стол заказов» (задача 99D-18,
 * решение владельца 31.10.2026).
 *
 * Обеспечительная часть с выдачи заказа и удержание при отказе лежат на
 * кошельке пайщика к списанию w.mkt.due и остаются паевым взносом. Когда и
 * сколько списывать, решает бэкенд по своему учёту заказов: первого числа
 * месяца, следующего за окончанием гарантийного срока, без подписи пайщика.
 * Контракт не хранит, кому и когда списывать (десятки тысяч строк в RAM на
 * месяц), и держит только потолок — не больше остатка кошелька пайщика.
 *
 * Движения одной транзакцией:
 *  - o.mkt.charge — w.mkt.due → w.mkt.fee (без проводки, транзит: прямой
 *    перевод с кошелька пайщика на кошелёк участка невозможен — разные username);
 *  - o.brn.common — w.mkt.fee → w.brn.common участка, Дт 80 / Кт 86: здесь
 *    паевое становится членским взносом участка (branch::accrue).
 *
 * Место под коэффициент экономического участия: позже здесь сумма будет
 * делиться — часть в членский взнос участка, часть обратно пайщику на паевой
 * кошелёк. Сейчас в членский взнос идёт вся сумма.
 *
 * Guards:
 *  - require_auth(coopname) — бэкенд от имени кооператива;
 *  - сумма в валюте кооператива и больше нуля;
 *  - участок существует;
 *  - остаток w.mkt.due пайщика не меньше суммы.
 *
 * Заказ по `order_hash` не ищется: к моменту списания он может быть уже
 * закрыт (`closeorder` стирает запись). Хэш — только хэш процесса заказа,
 * чтобы списание легло в его нитку.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::chargedue(eosio::name coopname,
                            eosio::name username,
                            eosio::name braname,
                            checksum256 order_hash,
                            eosio::asset amount) {
  require_auth(coopname);

  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "MARKETPLACE_DUE_AMOUNT_INVALID: Сумма списания обеспечительной части должна быть больше нуля и в валюте кооператива");
  get_branch_or_fail(coopname, braname);

  const auto due = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SECURE_DUE, username);
  eosio::check(due.available >= amount,
               std::string{"MARKETPLACE_DUE_EXCEEDS: К списанию заявлено больше, чем лежит на кошельке обеспечительной части: заявлено "} +
                 amount.to_string() + ", доступно " + due.available.to_string());

  // Коэффициент экономического участия (следующая задача): здесь появится
  // деление `amount` на членский взнос участка и возврат пайщику.
  const eosio::asset to_membership = amount;

  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CHARGE_DUE,
                 processes::marketplace::SUPPLY,
                 to_membership, username, order_hash,
                 Marketplace::Memo::get_charge_due_memo());

  Branch::accrue(_marketplace, coopname, braname, to_membership,
                 processes::marketplace::SUPPLY, order_hash,
                 Marketplace::Memo::get_charge_due_distribute_memo());
}
