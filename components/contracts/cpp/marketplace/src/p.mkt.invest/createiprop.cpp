/**
 * @brief Инициатор подаёт заявление о паевом взносе имуществом в кооперативный
 * участок (registry 1120; задача 99D-27). Путь как в Благоросте: заявление →
 * одобрение председателя участка → решение совета → акт (вносящий, затем
 * председатель участка). Цену называет вносящий; по ней имущество принимается
 * на счёт 10 и по ней же возмещается из экономии участка.
 *
 * Движений по средствам нет. Заявление хранится в строке `invprops` до второй
 * подписи акта.
 *
 * Guards: авторизация кооператива; договор участия подписан; участок есть;
 * пайщик — оператор участка; заявление подписано пайщиком; хэш паевого взноса
 * новый; цена больше нуля; описание не пустое.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::createiprop(eosio::name coopname, eosio::name username, eosio::name braname,
                              checksum256 property_hash, eosio::asset amount,
                              std::string description, document2 statement) {
  require_auth(coopname);
  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "MARKETPLACE_IPROP_AMOUNT_INVALID: Цена имущества должна быть больше нуля и в валюте кооператива");
  eosio::check(!description.empty(),
               "MARKETPLACE_IPROP_DESCRIPTION_REQUIRED: Опишите вносимое имущество");
  eosio::check(property_hash != checksum256{},
               "MARKETPLACE_IPROP_HASH_MISSING: Не указан идентификатор паевого взноса имуществом");
  eosio::check(!is_empty_document(statement),
               "MARKETPLACE_IPROP_STATEMENT_MISSING: Отсутствует заявление о паевом взносе имуществом");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);
  get_active_participant_or_fail(coopname, username);
  eosio::check(MarketInvest::has_agreement(coopname, username, braname),
               "MARKETPLACE_INVAGR_REQUIRED: Сначала подпишите договор об участии в хозяйственной деятельности этого участка");
  eosio::check(MarketInvest::is_operator(coopname, braname, username),
               "MARKETPLACE_INVEST_NOT_OPERATOR: Вносить имущество в участок может председатель или доверенное лицо участка");

  mkt_invprops_index props(_marketplace, coopname.value);
  auto by_hash = props.get_index<"byhash"_n>();
  eosio::check(by_hash.find(property_hash) == by_hash.end(),
               "MARKETPLACE_IPROP_EXISTS: Заявление с таким идентификатором уже подано");

  props.emplace(RamPayer::of(props, coopname), [&](auto& row) {
    row.id          = props.available_primary_key();
    row.hash        = property_hash;
    row.braname     = braname;
    row.username    = username;
    row.status      = MarketInvest::PropertyStatus::CREATED;
    row.amount      = amount;
    row.description = description;
    row.statement   = statement;
    row.created_at  = eosio::time_point_sec(eosio::current_time_point());
  });
}
