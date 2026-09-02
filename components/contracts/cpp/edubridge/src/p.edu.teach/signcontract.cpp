/**
 * @brief Преподаватель подписывает Договор участия в хозяйственной
 * деятельности — первая подпись.
 *
 * Открывает процесс p.edu.teach: запись договора заводится в `pending`, а
 * документ уходит председателю совета на вторую подпись через одобрение
 * (`Soviet::create_approval`). Публикации в реестре документов на этом шаге
 * нет — в реестр попадает уже двухподписный документ в `apprvcontr`.
 *
 * Guards:
 *  - договор подписан преподавателем; hash документа совпадает с contract_hash;
 *  - преподаватель — активный член кооператива;
 *  - у преподавателя нет договора (ни действующего, ни ожидающего подписи);
 *  - contract_hash ещё не занят.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::signcontract(eosio::name coopname,
                             eosio::name username,
                             checksum256 contract_hash,
                             document2 contract) {
  require_auth(coopname);

  eosio::check(!is_empty_document(contract), "Отсутствует договор участия в хозяйственной деятельности");
  eosio::check(contract.hash == contract_hash, "Hash договора не совпадает с переданным документом");
  verify_document_or_fail(contract, { username });

  get_participant_or_fail(coopname, username);

  auto existing = Edubridge::get_contract(coopname, username);
  eosio::check(!existing.has_value(),
               existing.has_value() && existing->status == Edubridge::ContractStatus::PENDING
                 ? "Договор уже ожидает подписи председателя совета"
                 : "Преподаватель уже подписал договор участия в хозяйственной деятельности");

  edu_contracts_index contracts(_edubridge, coopname.value);
  auto by_hash = contracts.get_index<"byhash"_n>();
  eosio::check(by_hash.find(contract_hash) == by_hash.end(), "Договор с указанным hash уже существует");

  contracts.emplace(_edubridge, [&](auto& c) {
    c.id            = get_global_id_in_scope(_edubridge, coopname, "educontracts"_n);
    c.username      = username;
    c.contract_hash = contract_hash;
    c.status        = Edubridge::ContractStatus::PENDING;
    c.created_at    = eosio::time_point_sec(eosio::current_time_point());
    c.approved_at   = eosio::time_point_sec(0);
  });

  // Вторая подпись — председатель совета со стола «Запросы одобрений».
  ::Soviet::create_approval(
    _edubridge,
    coopname,
    username,
    contract,
    Names::Edubridge::SIGN_CONTRACT,
    contract_hash,
    _edubridge,
    Names::Edubridge::APPROVE_CONTRACT,
    Names::Edubridge::DECLINE_CONTRACT,
    std::string("")
  );
}
