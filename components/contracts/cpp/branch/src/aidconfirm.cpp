/**
 * @brief Callback от gateway о фактическом подтверждении выплаты
 * материальной помощи (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир подтвердил реальный банковский перевод получателю.
 * Здесь — единственное место, где применяется списание. С 2026-08-13
 * кооператив удерживает НДФЛ, поэтому сумма заявления расходится надвое:
 *
 *  - Ledger2::apply(o.brn.aidtax, tax, …, hash=aid.hash) — TRANSFER
 *    w.brn.aidreq → w.sov.ndfl, Дт 86 / Кт 68 (удержанный налог);
 *  - Ledger2::apply(o.brn.aidfnd, net, …, hash=aid.hash) — TRANSFER
 *    w.brn.aidreq → w.fnd.mutual, без проводки (транзит через фонд взаимного
 *    обеспечения, задача 99D-25);
 *  - Ledger2::apply(o.brn.aid, net, …, hash=aid.hash) — BURN с кошелька
 *    фонда w.fnd.mutual, Дт 86 / Кт 51 (выплата на руки).
 *
 * Ровно ту же сумму `net` кассир увидел в исходящем платеже: она посчитана
 * из `aid.amount` тем же `BranchNdfl`, поэтому расхождения между платёжкой и
 * проводкой быть не может.
 *
 * Выплата подтверждена — терминал жизненного цикла: запись заявления стирается
 * из RAM, история — в журнале действий и в решении совета.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта;
 *  - заявление найдено по outcome_hash и одобрено советом (статус authorized):
 *    исходящий платёж создаётся только в `onaidauth`, поэтому иной статус
 *    означал бы выплату в обход решения совета.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::aidconfirm(eosio::name coopname,
                                           eosio::checksum256 outcome_hash) {
  require_auth(_gateway);

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявление на материальную помощь не найдено по outcome_hash из callback'а gateway");
  eosio::check(it->status == AidStatus::AUTHORIZED,
               "Выплата материальной помощи не одобрена решением совета");

  // Кооператив — налоговый агент: с персонального кошелька уходит вся сумма
  // заявления, но двумя разными путями. Порядок важен — сначала удержание,
  // потом выплата: если на кошельке не хватает средств (получатель успел
  // перевести их в «Стол заказов»), транзакция упадёт до того, как деньги
  // уйдут получателю, а не после.
  const eosio::asset tax = BranchNdfl::calc_tax(it->amount);
  const eosio::asset net = it->amount - tax;

  // Выплата из средств инициаторов участка (задача 99D-28): налог и сумма на
  // руки списываются с пула по счёту вложений (Дт 08), транзита через фонд
  // взаимного обеспечения нет — средства не фондовые; затем вся сумма
  // заявления входит в базу возврата вложений инициаторов.
  // Пул — кошелёк кооператива, пайщик в операции — метка. Метка — получатель,
  // как у выплаты с фонда (o.brn.aid): по ней 6-НДФЛ относит доход и налог к
  // налогоплательщику. С меткой участка такая помощь в отчёт не попадала.
  if (it->source.has_value() && it->source.value() == ledger2_wallets::MARKETPLACE_INVEST_POOL) {
    if (tax.amount > 0) {
      Ledger2::apply(_branch, coopname,
                     operations::marketplace::INVEST_AID_TAX,
                     processes::branch::AID,
                     tax, it->username, it->hash,
                     "Удержание налога на доходы физических лиц из материальной помощи, получатель " +
                       it->username.to_string());
    }
    Ledger2::apply(_branch, coopname,
                   operations::marketplace::INVEST_AID,
                   processes::branch::AID,
                   net, it->username, it->hash,
                   "Материальная помощь из средств инициаторов участка, получатель " + it->username.to_string());
    MarketInvest::spent_pool(_branch, coopname, it->braname, it->amount, it->hash);
    byhash.erase(it);
    return;
  }

  // Заявление, поданное до кошелька заявлений (08.11.2026), переводит сумму
  // с персонального кошелька в момент выплаты; дальше путь общий.
  if (!(it->source.has_value() && it->source.value() == ledger2_wallets::BRANCH_AID_REQUEST)) {
    Ledger2::apply(_branch, coopname, operations::branch::AID_REQUEST, processes::branch::AID,
                   it->amount, it->username, it->hash,
                   "Сумма заявления на материальную помощь переведена на кошелёк заявлений");
  }
  if (tax.amount > 0) {
    Ledger2::apply(_branch, coopname,
                   operations::branch::FINANCIAL_AID_TAX,
                   processes::branch::AID,
                   tax, it->username, it->hash,
                   "Удержание налога на доходы физических лиц из материальной помощи");
  }

  // Транзит через фонд взаимного обеспечения (задача 99D-25, решение владельца
  // 03.11.2026): сумма на руки сначала направляется с персонального кошелька
  // получателя на кошелёк фонда (внутри 86, без проводки), затем списывается с
  // фонда на расчётный счёт (Дт 86 / Кт 51) — одной транзакцией. Остаток фонда не
  // меняется, оборот фонда — выплаченная помощь по факту. Налог до ответа
  // бухгалтера (задача BB1-3) идёт напрямую с кошелька получателя.
  Ledger2::apply(_branch, coopname,
                 operations::branch::AID_TO_FUND,
                 processes::branch::AID,
                 net, it->username, it->hash,
                 "Направление материальной помощи в фонд взаимного обеспечения");
  Ledger2::apply(_branch, coopname,
                 operations::branch::FINANCIAL_AID,
                 processes::branch::AID,
                 net, it->username, it->hash,
                 "Материальная помощь доверенному кооперативного участка");

  byhash.erase(it);
}
