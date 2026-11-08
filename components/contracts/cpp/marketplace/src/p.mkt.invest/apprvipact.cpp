/**
 * @brief Председатель совета подписал акт приёма-передачи имущества второй
 * подписью — имущество принято (registry 1122; задача 99D-27). Вызывается
 * контрактом совета (`soviet::confirmapprv`) после подтверждения одобрения,
 * созданного подписью вносящего (`act1iprop`); подпись председателя совета
 * совет уже проверил.
 *
 * Эффект: имущество ставится на счёт 10 по цене приёма, цена зачисляется
 * паевым взносом инициатора на кошелёк договора участия (o.mkt.iprop, Дт 10 / Кт 80).
 * Имущество сразу считается использованным: оно входит в базу возмещения
 * участка и возмещается из экономии наравне с израсходованными деньгами.
 * Строка заявления стирается; акт публикуется в реестр документов (пакет =
 * хэш паевого взноса).
 *
 * `username` — тот, кто подтвердил одобрение (председатель совета), а не
 * вносящий: заявление находится по хэшу.
 *
 * Guards: только контракт совета; акт подписан вносящим; вторая подпись
 * лежит на том же акте.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::apprvipact(eosio::name coopname, eosio::name username,
                             checksum256 property_hash, document2 approved_document) {
  require_auth(_soviet);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, property_hash);
  eosio::check(prop.status == MarketInvest::PropertyStatus::ACT1,
               "MARKETPLACE_IPROP_ACT1_REQUIRED: Председатель совета подписывает акт после подписи вносящего");
  eosio::check(!is_empty_document(approved_document),
               "MARKETPLACE_IPROP_ACT_MISSING: Отсутствует акт приёма-передачи имущества");
  // Вторая подпись ложится на тот же акт, что подписал вносящий.
  eosio::check(approved_document.hash == prop.act.hash,
               "MARKETPLACE_IPROP_ACT_MISMATCH: Председатель совета подписывает тот же акт, что вносящий");
  verify_document_or_fail(approved_document, { prop.username });
  Ledger2::apply(_marketplace, coopname, operations::marketplace::INVEST_PROPERTY,
                 processes::marketplace::INVEST, prop.amount, prop.username, property_hash,
                 Marketplace::Memo::get_invest_property_memo());
  Marketplace::add_investment(coopname, prop.braname, prop.username, MarketInvest::zero_asset(), prop.amount);
  Soviet::make_complete_document(_marketplace, coopname, prop.username, "apprvipact"_n,
                                 property_hash, approved_document);
  MarketInvestProperty::erase(coopname, prop.id);
}
