#pragma once

#include <eosio/eosio.hpp>
#include <string>

#include "../../consts.hpp"
#include "../actions.hpp"
#include "../names.hpp"
#include "../../domain/document_core.hpp"

using namespace eosio;

#define CREATEAGENDA_SIGNATURE name coopname, name username, name type, checksum256 hash, name callback_contract, name confirm_callback, name decline_callback, document2 statement, std::string meta
using createagenda_interface = void(CREATEAGENDA_SIGNATURE);

#define CREATEAPPRV_SIGNATURE name coopname, name username, document2 document, name type, checksum256 approval_hash, name callback_contract, name callback_action_approve, name callback_action_decline, std::string meta
using createapprv_interface = void(CREATEAPPRV_SIGNATURE);

#define DECLINE_CALLBACK_SIGNATURE name coopname, checksum256 hash, std::string reason
using decline_callback_interface = void(DECLINE_CALLBACK_SIGNATURE);

// Общая ветка отказа решения совета: отправка коллбэка отклонения инициатору
// (если решение пришло из внешнего процесса) + удаление решения из таблицы.
// Используется при просрочке (cancelexprd) и при достижении отрицательного
// консенсуса голосов «против» (voteagainst). Определение — cancelexprd.cpp.
void decline_and_erase_decision(eosio::name coopname, uint64_t decision_id, const std::string &reason);

#define AUTHORIZE_CALLBACK_SIGNATURE name coopname, checksum256 hash, document2 authorization
using authorize_callback_interface = void(AUTHORIZE_CALLBACK_SIGNATURE);

#define NEWSUBMITTED_SIGNATURE name coopname, name username, name action, checksum256 package, document2 document
using newsubmitted_interface = void(NEWSUBMITTED_SIGNATURE);

#define NEWRESOLVED_SIGNATURE name coopname, name username, name action, checksum256 package, document2 document
using newresolved_interface = void(NEWRESOLVED_SIGNATURE);

#define NEWDECISION_SIGNATURE name coopname, name username, name action, checksum256 package, document2 document
using newdecision_interface = void(NEWDECISION_SIGNATURE);

#define NEWDECLINED_SIGNATURE name coopname, name username, checksum256 package, document2 document
using newdeclined_interface = void(NEWDECLINED_SIGNATURE);

#define NEWACT_SIGNATURE name coopname, name username, name action, checksum256 package, document2 document
using newact_interface = void(NEWACT_SIGNATURE);

#define NEWLINK_SIGNATURE name coopname, name username, name action, checksum256 package, document2 document
using newlink_interface = void(NEWLINK_SIGNATURE);

#define NEWAGREEMENT_SIGNATURE name coopname, name username, name type, document2 document
using newagreement_interface = void(NEWAGREEMENT_SIGNATURE);

#define NEWPACKAGE_SIGNATURE name coopname, name username, name action, checksum256 package
using newpackage_interface = void(NEWPACKAGE_SIGNATURE);

#define OPENPROGWALL_SIGNATURE name coopname, name username, name program_type, uint64_t agreement_id
using openprogwall_interface = void(OPENPROGWALL_SIGNATURE);

namespace Soviet {

inline void create_agenda(name calling_contract, CREATEAGENDA_SIGNATURE) {
  Action::send<createagenda_interface>(_soviet, Names::External::CREATE_AGENDA, calling_contract, coopname,
                                       username, type, hash, callback_contract, confirm_callback,
                                       decline_callback, statement, meta);
}

inline void create_approval(name calling_contract, CREATEAPPRV_SIGNATURE) {
  Action::send<createapprv_interface>(_soviet, Names::External::CREATE_APPROVAL, calling_contract, coopname,
                                       username, document, type, approval_hash, callback_contract,
                                       callback_action_approve, callback_action_decline, meta);
}

inline void make_complete_document(name calling_contract, name coopname, name username, name action,
                                   checksum256 package, document2 document) {
  Action::send<newsubmitted_interface>(_soviet, "newsubmitted"_n, calling_contract, coopname, username, action,
                                       package, document);

  Action::send<newresolved_interface>(_soviet, "newresolved"_n, calling_contract, coopname, username, action,
                                      package, document);
}

} // namespace Soviet
