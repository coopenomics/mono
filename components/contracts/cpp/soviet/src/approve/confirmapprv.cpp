/**
 * @brief Подтверждение одобрения документа
 * Подтверждает одобрение документа и выполняет соответствующий обратный вызов.
 * Удаляет запись об одобрении после успешного выполнения.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, подтверждающего одобрение
 * @param approval_hash Хеш одобрения для подтверждения
 * @param approved_document Подтвержденный документ (опционально, может быть пустым только если заявление пустое)
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username
 */
void soviet::confirmapprv(eosio::name coopname, eosio::name username, checksum256 approval_hash, std::optional<document2> approved_document)
{
   require_auth(coopname);

   auto exist_approval = Approver::get_approval(coopname, approval_hash);
   eosio::check(exist_approval.has_value(), "Апррувал не найден с указанным хэшем");

   auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
   auto chairman = soviet.get_chairman();
 
   Approver::approvals_index approvals(_soviet, coopname.value);
   auto itr = approvals.find(exist_approval -> id);

   if (approved_document.has_value()) {
      verify_document_or_fail(approved_document.value(), { chairman });
      // Согласие председателя подписано ключом его аккаунта. Робот совета сюда не
      // ходит (он шлёт только голоса и протокол), поэтому разрешение обычное.
      verify_signer_keys_or_fail(approved_document.value(), chairman);
   } else {
      eosio::check(is_empty_document(itr -> document), "Пустой документ может быть принят только для пустого заявления");
   }

   document2 approved_document_for_send = approved_document.has_value() ? approved_document.value() : document2();
   action(
     permission_level{_soviet, "active"_n},
     itr->callback_contract,
     itr->callback_action_approve,
     std::make_tuple(coopname, username, approval_hash, approved_document_for_send)
   ).send();

   approvals.erase(itr);
}
