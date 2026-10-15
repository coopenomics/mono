// capital.hpp

#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "../lib/index.hpp"

using namespace eosio;
using std::string;

/**
 *  \ingroup public_contracts
 *  @brief  Контракт Wallet управляет взносами и возвратами взносов по ЦПП "Цифровой Кошелёк".
 */
class [[eosio::contract]] wallet : public coop_contract {
public:
    using coop_contract::coop_contract;
    [[eosio::action]] void migrate();
    /// Очистка отработавших записей по правилам контракта (lib/core/cleanup.hpp); плейбук вызывает её на каждом деплое.
    [[eosio::action]] void cleanup();
    
    //паевой взнос
    [[eosio::action]] void createdpst(eosio::name coopname, eosio::name username, checksum256 deposit_hash, eosio::asset quantity);
    [[eosio::action]] void completedpst(eosio::name coopname, checksum256 deposit_hash);
    [[eosio::action]] void declinedpst(eosio::name coopname, checksum256 deposit_hash, std::string reason);
 
    //возврат паевого взноса
    [[eosio::action]] void createwthd(eosio::name coopname, eosio::name username, checksum256 withdraw_hash, eosio::asset quantity, document2 statement);
    [[eosio::action]] void completewthd(COMPLETEWTHD_SIGNATURE);
    [[eosio::action]] void declinewthd(DECLINEWTHD_SIGNATURE);
    [[eosio::action]] void authwthd(AUTHWTHD_SIGNATURE);

    // программные соглашения (Эпик 2 компонента 48; ADR-008)
    [[eosio::action]] void signagree(eosio::name coopname, eosio::name username, uint64_t program_id, document2 document, uint64_t draft_id);
    [[eosio::action]] void revokeagree(eosio::name coopname, eosio::name username, uint64_t program_id);
    [[eosio::action]] void migrate3(eosio::name coopname, eosio::name username, uint64_t program_id, checksum256 doc_hash, uint16_t version, uint64_t draft_id, time_point signed_at);
    [[eosio::action]] void importagree(eosio::name coopname, eosio::name username, uint64_t program_id);

    // Счётчик идентификаторов (get_global_id) живёт в аккаунте кошелька; без
    // описания в ABI индексер не разбирал его строки и публиковал их пустыми.
    struct [[eosio::table, eosio::contract(WALLET)]] counts : counts_base {};
};