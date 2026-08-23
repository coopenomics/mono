// meet.hpp
#pragma once
#include <algorithm>
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include "../lib/index.hpp"
#include "include/tables/tables.hpp"
#include "include/structs/structs.hpp"

using namespace eosio;
using std::string;

/**
\defgroup public_meet Контракт MEET

* Смарт-контракт управления собраниями пайщиков кооператива предназначен для организации и проведения общих собраний участников.
*/

/**
\defgroup public_meet_processes Процессы
\ingroup public_meet
*/

/**
\defgroup public_meet_actions Действия
\ingroup public_meet
*/

/**
\defgroup public_meet_tables Таблицы
\ingroup public_meet
*/

/**
\defgroup public_meet_consts Константы
\ingroup public_meet
*/

/**
 *  \ingroup public_contracts
 *  @brief  Контракт Meet управляет собраниями пайщиков.
 */
class [[eosio::contract]] meet : public contract {
public:
    using contract::contract;

    /**
     * @brief Минимальная задержка до открытия общего собрания.
     * @ingroup public_consts
     * @ingroup public_meet_consts

     */
    static constexpr uint32_t MIN_OPEN_AGM_DELAY_SEC = 60 * 60 * 24 * 15; // 15 дней

    /**
     * @brief Нижняя граница требования по кворуму при перезапуске собрания.
     * @ingroup public_consts
     * @ingroup public_meet_consts

     */
    static constexpr double MIN_QUORUM_PERCENT = 25.0; // ниже этой планки требование не опускается

    /**
     * @brief Флаг тестового режима.
     * @ingroup public_consts
     * @ingroup public_meet_consts

     */
    static constexpr bool TEST_MODE = true; // Флаг тестового режима

    [[eosio::action]]
    void createmeet(name coopname, checksum256 hash, eosio::name initiator, name presider, name secretary, std::vector<meet_point> agenda, document2 proposal, time_point_sec open_at, time_point_sec close_at);
    [[eosio::action]]
    void authmeet(eosio::name coopname, checksum256 hash, document2 authorization);
    [[eosio::action]]
    void declmeet(name coopname, checksum256 hash, std::string reason);
    
    [[eosio::action]]
    void gmnotify(name coopname, checksum256 hash, name username, document2 notification);
    
    [[eosio::action]]
    void vote(name coopname, checksum256 hash, name username, document2 ballot, std::vector<vote_point> votes);
    
    [[eosio::action]]
    void restartmeet(name coopname, checksum256 hash, checksum256 new_hash, document2 newproposal, time_point_sec new_open_at, time_point_sec new_close_at);

    [[eosio::action]]
    void signbysecr(name coopname, name username, checksum256 hash, document2 secretary_decision);
    
    [[eosio::action]]
    void signbypresid(name coopname, name username, checksum256 hash, document2 presider_decision);
    
    [[eosio::action]] void migrate();
    
    [[eosio::action]] void delmeet(eosio::name coopname, uint64_t meet_id);

    // Сервисное действие:
    [[eosio::action]] void newgdecision(NEWGDECISION_SIGNATURE);
private:
    std::optional<Meet::meet> get_meet(eosio::name coopname, const checksum256 &hash);
};
