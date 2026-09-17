/**
 * @brief Создание одобрения документа
 * Создает новое одобрение документа с указанными параметрами и обратными вызовами.
 * Используется для инициации процесса одобрения документов в системе.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, создающего одобрение
 * @param document Документ для одобрения
 * @param type Тип одобрения
 * @param approval_hash Хеш одобрения
 * @param callback_contract Контракт для обратного вызова
 * @param callback_action_approve Действие подтверждения
 * @param callback_action_decline Действие отклонения
 * @param meta Дополнительные метаданные
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::createapprv(eosio::name coopname,
                         eosio::name username,
                         document2 document,
                         name type,
                         checksum256 approval_hash,
                         eosio::name callback_contract,
                         eosio::name callback_action_approve,
                         eosio::name callback_action_decline,
                         std::string meta)
{
    auto payer = check_auth_and_get_payer_or_fail(contracts_whitelist);

    eosio::check(callback_contract != ""_n, "callback_contract required");
    eosio::check(callback_action_approve != ""_n, "callback_action_approve required");
    eosio::check(callback_action_decline != ""_n, "callback_action_decline required");

    if (!is_empty_document(document)) {
      verify_document_or_fail(document);
      // Заявление подаёт сам пайщик: транзакцию шлёт кооператив, и без сверки
      // ключа с его аккаунтом заявку можно было бы подать за него чужим ключом.
      verify_signer_keys_or_fail(document, username);
    }
    
    auto exist_approval = Approver::get_approval(coopname, approval_hash);
    eosio::check(!exist_approval.has_value(), "Аппрувал с указанным хэшем уже существует");
    
    auto apprv_id = get_global_id_in_scope(_soviet, coopname, "approvals"_n);
    
    Approver::approvals_index approvals(_soviet, coopname.value);
    
    approvals.emplace(_soviet, [&](auto &a) {
      a.id                      = apprv_id;
      a.coopname                = coopname;
      a.username                = username;
      a.type                    = type;
      a.document                = document;
      a.approval_hash           = approval_hash;
      a.callback_contract       = callback_contract;
      a.callback_action_approve = callback_action_approve;
      a.callback_action_decline = callback_action_decline;
      a.meta                    = meta;
      a.created_at              = eosio::time_point_sec(current_time_point());
    });
}
