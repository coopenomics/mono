/**
 * @brief Председатель участка подписывает акт приёма-передачи второй подписью
 * — имущество принято (registry 1122; задача 99D-27).
 *
 * Эффект: имущество ставится на счёт 10 по цене приёма, цена зачисляется
 * паевым взносом инициатора на кошелёк договора участия (o.mkt.iprop, Дт 10 / Кт 80).
 * Имущество сразу считается использованным: оно входит в базу возврата
 * участка и возмещается из экономии наравне с израсходованными деньгами.
 * Строка заявления стирается; акт публикуется в реестр документов (пакет =
 * хэш паевого взноса).
 *
 * Guards: авторизация кооператива; акт подписан вносящим; вторая подпись на
 * том же акте — председателя участка.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::act2iprop(eosio::name coopname, eosio::name braname,
                            checksum256 property_hash, document2 act) {
  require_auth(coopname);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, property_hash);
  eosio::check(prop.braname == braname,
               "MARKETPLACE_IPROP_BRANCH_MISMATCH: Заявление подано в другой участок");
  eosio::check(prop.status == MarketInvest::PropertyStatus::ACT1,
               "MARKETPLACE_IPROP_ACT1_REQUIRED: Председатель участка подписывает акт после подписи вносящего");
  const eosio::name trustee = MarketInvestProperty::trustee_of(coopname, braname);
  eosio::check(!is_empty_document(act),
               "MARKETPLACE_IPROP_ACT_MISSING: Отсутствует акт приёма-передачи имущества");
  // Вторая подпись ложится на тот же акт, что подписал вносящий.
  eosio::check(act.hash == prop.act.hash,
               "MARKETPLACE_IPROP_ACT_MISMATCH: Председатель участка подписывает тот же акт, что вносящий");
  verify_document_or_fail(act, { prop.username, trustee });
  verify_signer_keys_or_fail(act, trustee);

  Ledger2::apply(_marketplace, coopname, operations::marketplace::INVEST_PROPERTY,
                 processes::marketplace::INVEST, prop.amount, prop.username, property_hash,
                 Marketplace::Memo::get_invest_property_memo());

  Marketplace::add_investment(coopname, braname, prop.username, MarketInvest::zero_asset(), prop.amount);

  Soviet::make_complete_document(_marketplace, coopname, prop.username, "act2iprop"_n,
                                 property_hash, act);
  MarketInvestProperty::erase(coopname, prop.id);
}
