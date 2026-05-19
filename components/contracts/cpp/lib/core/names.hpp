#pragma once

#include <eosio/name.hpp>

/*!
 *  \brief Константы для имен коллбэк-действий контракта Capital
 */
namespace Names {
  namespace Ledger {
    constexpr eosio::name AUTHORIZE_WRITEOFF = "auth"_n;
    constexpr eosio::name DECLINE_WRITEOFF = "decline"_n;
  }
  
  namespace Capital {
    // Коллбэки для коммитов
    constexpr eosio::name APPROVE_COMMIT = "approvecmmt"_n;
    constexpr eosio::name DECLINE_COMMIT = "declinecmmt"_n;
    
    // Коллбэки для проектных имущественных взносов
    constexpr eosio::name APPROVE_PROPERTY = "approvepjprp"_n;
    constexpr eosio::name DECLINE_PROPERTY = "declinepjprp"_n;
    
    // Коллбэки для программных имущественных взносов
    constexpr eosio::name APPROVE_PROGRAM_PROPERTY = "approvepgprp"_n;
    constexpr eosio::name DECLINE_PROGRAM_PROPERTY = "declinepgprp"_n;
    constexpr eosio::name AUTHORIZE_PROGRAM_PROPERTY = "authpgprp"_n;
    constexpr eosio::name SIGN_ACT1_PROGRAM_PROPERTY = "act1pgprp"_n;
    constexpr eosio::name SIGN_ACT2_PROGRAM_PROPERTY = "act2pgprp"_n;
    
    // Коллбэки для регистрации участников
    constexpr eosio::name APPROVE_CONTRIBUTOR = "approvereg"_n;
    constexpr eosio::name DECLINE_CONTRIBUTOR = "declinereg"_n;
    
    // Коллбэки для инвестиций
    constexpr eosio::name APPROVE_INVESTMENT = "approveinvst"_n;
    constexpr eosio::name DECLINE_INVESTMENT = "declineinvst"_n;
    
    // Коллбэки для приложений к договорам УХД
    constexpr eosio::name APPROVE_APPENDIX = "apprvappndx"_n;
    constexpr eosio::name DECLINE_APPENDIX = "dclineappndx"_n;
    
    // Коллбэки для возврата из проекта
    constexpr eosio::name AUTHORIZE_PROJECT_WITHDRAW = "capauthwthd2"_n;
    constexpr eosio::name DECLINE_PROJECT_WITHDRAW = "capdeclwthd2"_n;
    
    // Коллбэки для возврата из программы
    constexpr eosio::name AUTHORIZE_PROGRAM_WITHDRAW = "capauthwthd3"_n;
    constexpr eosio::name DECLINE_PROGRAM_WITHDRAW = "capdeclwthd3"_n;
    
    // Коллбэки для расходов
    constexpr eosio::name AUTHORIZE_EXPENSE = "capauthexpns"_n;
    constexpr eosio::name DECLINE_EXPENSE = "capdeclexpns"_n;
    
    // Коллбэки для долгов
    constexpr eosio::name AUTHORIZE_DEBT = "debtauthcnfr"_n;
    constexpr eosio::name CONFIRM_DEBT_PAYMENT = "debtpaycnfrm"_n;
    constexpr eosio::name DECLINE_DEBT = "declinedebt"_n;
    
    // Коллбэки для результатов
    constexpr eosio::name AUTHORIZE_RESULT = "authrslt"_n;
    constexpr eosio::name DECLINE_RESULT = "declrslt"_n;
    constexpr eosio::name APPROVE_RESULT = "approverslt"_n;
    constexpr eosio::name SIGN_ACT1_RESULT = "act1result"_n;
    constexpr eosio::name SIGN_ACT2_RESULT = "act2result"_n;

    // Коллбэки для проектов
    constexpr eosio::name AUTHORIZE_PROJECT = "authrprj"_n;
    constexpr eosio::name DECLINE_PROJECT = "declprj"_n;
    
    // Коллбэки для платежей
    constexpr eosio::name CONFIRM_EXPENSE_PAYMENT = "exppaycnfrm"_n;
  }
  
  namespace Loan {
    constexpr eosio::name CREATE_DEBT = "createdebt"_n;
    constexpr eosio::name SETTLE_DEBT = "settledebt"_n;
  }
  
  namespace External {
    // Внешние действия в других контрактах
    constexpr eosio::name CREATE_OUTPAY = "createoutpay"_n;
    constexpr eosio::name OPEN_PROGRAM_WALLET = "openprogwall"_n;
    
    // Действия для отправки в soviet
    constexpr eosio::name CREATE_APPROVAL = "createapprv"_n;
    constexpr eosio::name CREATE_AGENDA = "createagenda"_n;
  }
  
  namespace SovietActions {
    // Типы действий для рассмотрения в совете
    constexpr eosio::name CAPITAL_WITHDRAW_FROM_PROGRAM = "capwthdrprog"_n;
    constexpr eosio::name CAPITAL_WITHDRAW_FROM_PROJECT = "capwthdrproj"_n;
    constexpr eosio::name CAPITAL_RESOLVE_EXPENSE = "capresexpns"_n;
    constexpr eosio::name CREATE_RESULT = "createresult"_n;
    constexpr eosio::name CREATE_DEBT = "createdebt"_n;
    constexpr eosio::name CREATE_PROJECT = "createprj"_n;
    constexpr eosio::name SEND_AGREEMENT = "sndagreement"_n;
  }

  namespace WalletActions {
    constexpr eosio::name SIGN_AGREEMENT = "signagree"_n;
  }
}

/*!
 *  \brief Константы для типов аппрувалов (максимум 12 символов)
 */
namespace Names {
  namespace Soviet {
    constexpr eosio::name CONVERT_TO_AXON = "converttoaxn"_n;
  }
  
  namespace Capital {
    constexpr eosio::name REGISTER_CONTRIBUTOR = "regcontrib"_n; // акцепт договора УХД
    constexpr eosio::name CREATE_DEBT = "createdebt"_n; // акцепт ссуды
    constexpr eosio::name CREATE_COMMIT = "createcmmt"_n; // акцепт коммита
    constexpr eosio::name CREATE_PROPERTY = "createpjprp"_n; // акцепт проектного имущественного взноса
    constexpr eosio::name CREATE_PROGRAM_PROPERTY = "createpgprp"_n; // акцепт программного имущественного взноса
    constexpr eosio::name CREATE_APPENDIX = "createappndx"_n; // акцепт приложения
    constexpr eosio::name CREATE_INVESTMENT = "createinvest"_n; // акцепт инвестиции
    constexpr eosio::name CREATE_PROGRAM_INVESTMENT = "createpinv"_n; // акцепт программной инвестиции
    constexpr eosio::name CREATE_EXPENSE = "createexpnse"_n; // акцепт расхода
    constexpr eosio::name CREATE_WITHDRAW_1 = "createwthd1"_n; // акцепт возврата из задания
    constexpr eosio::name CREATE_WITHDRAW_2 = "createwthd2"_n; // акцепт возврата из проекта
    constexpr eosio::name CREATE_WITHDRAW_3 = "createwthd3"_n; // акцепт возврата из программы
    constexpr eosio::name CREATE_RESULT = "createresult"_n; // акцепт результата
    constexpr eosio::name CONVERT_SEGMENT = "convertsegm"_n; // финальная фаза p.cap.rid — трансляция паевого взноса
  }
}