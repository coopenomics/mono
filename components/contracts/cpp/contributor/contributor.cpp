// contributor.cpp
#include "contributor.hpp"

void contributor::init(eosio::name coopname) {
    global_state_table global_state_inst(_self, _self.value);
    auto itr = global_state_inst.find(0);
    eosio::check(itr == global_state_inst.end(), "Contract already initialized");
    
    global_state gs{
      .coopname = coopname,
    };
    
    global_state_inst.emplace(RamPayer::of(global_state_inst), [&](auto& s) {
        s = gs;
    });
}

void contributor::update_global_state(const global_state& gs) {
    global_state_table global_state_inst(_self, _self.value);
    auto itr = global_state_inst.find(0);
    check(itr != global_state_inst.end(), "Global state not found");
    global_state_inst.modify(itr, RamPayer::of(global_state_inst), [&](auto& s) {
        s = gs;
    });
}

void contributor::contribute(name coopname, name username, asset amount, name type) {
    require_auth(username);
    check(amount.symbol == TOKEN_SYMBOL, "Invalid token symbol");
    check(amount.is_valid(), "Invalid asset");
    check(amount.amount > 0, "Amount must be positive");

    auto gs = get_global_state(coopname);

    // Participants table
    participants_table participants(_self, _self.value);

    // Find or create participant
    auto idx = participants.get_index<"byaccount"_n>();
    auto participant_itr = idx.find(username.value);
    if (participant_itr == idx.end()) {
        // Create new participant
        participants.emplace(RamPayer::of(participants), [&](auto& p) {
            p.id = participants.available_primary_key();
            p.account = username;
            p.share_balance = asset(0, TOKEN_SYMBOL);
            p.pending_rewards = asset(0, TOKEN_SYMBOL);
            p.intellectual_contributions = asset(0, TOKEN_SYMBOL);
            p.property_contributions = asset(0, TOKEN_SYMBOL);
            p.total_contributions = asset(0, TOKEN_SYMBOL);
            p.reward_per_share_last = gs.cumulative_reward_per_share;
            p.withdrawed = asset(0, TOKEN_SYMBOL);
            p.queued_withdrawal = asset(0, TOKEN_SYMBOL);
        });
        participant_itr = idx.find(username.value);
    }

    if (type == "intellect"_n) {
        process_intellectual(coopname, username, amount);
    } else if (type == "property"_n) {
        process_property(coopname, username, amount);
    } else {
        check(false, "Unknown contribution type");
    }
}

void contributor::withdraw1(name coopname, name username, asset amount) {
    require_auth(username);
    check(amount.symbol == TOKEN_SYMBOL, "Invalid token symbol");
    check(amount.is_valid(), "Invalid asset");
    check(amount.amount > 0, "Amount must be positive");

    auto gs = get_global_state(coopname);

    // Participants table
    participants_table participants(_self, _self.value);
    auto idx = participants.get_index<"byaccount"_n>();
    auto participant_itr = idx.find(username.value);
    check(participant_itr != idx.end(), "Participant not found");

    // Check if participant is updated
    auto participant = *participant_itr;
    check(participant.reward_per_share_last == gs.cumulative_reward_per_share, "Please refresh before withdrawing");

    // Calculate maximum amount available for withdrawal
    asset max_withdrawable = participant.intellectual_contributions - participant.withdrawed;
    check(max_withdrawable.amount >= amount.amount, "Insufficient balance to withdraw");

    // Update participant data
    auto primary_itr = participants.find(participant_itr->primary_key());
    participants.modify(primary_itr, RamPayer::of(participants), [&](auto& p) {
        p.share_balance -= amount;
        p.withdrawed += amount;
    });

    // Update global state
    gs.total_shares -= amount;
    gs.total_withdrawed += amount;
    update_global_state(gs);

    // TODO Create gateway withdraw payment
    
}

void contributor::withdraw2(name coopname, name username, asset amount) {
    require_auth(username);
    check(amount.symbol == TOKEN_SYMBOL, "Invalid token symbol");
    check(amount.is_valid(), "Invalid asset");
    check(amount.amount > 0, "Amount must be positive");

    auto gs = get_global_state(coopname);

    // Participants table
    participants_table participants(_self, _self.value);
    auto idx = participants.get_index<"byaccount"_n>();
    auto participant_itr = idx.find(username.value);
    check(participant_itr != idx.end(), "Participant not found");

    // Check if participant is updated
    auto participant = *participant_itr;
    check(participant.reward_per_share_last == gs.cumulative_reward_per_share, "Please refresh before withdrawing");

    // Calculate available balance excluding queued withdrawals
    asset available_balance = participant.share_balance - participant.queued_withdrawal;
    check(available_balance.amount >= amount.amount, "Insufficient balance to withdraw");

    // Add withdrawal request to queue
    withdrawals_table withdrawals(_self, _self.value);
    withdrawals.emplace(RamPayer::of(withdrawals), [&](auto& w) {
        w.id = withdrawals.available_primary_key();
        w.account = username;
        w.amount = amount;
        w.timestamp = current_time_point().sec_since_epoch();
    });

    // Update participant data
    auto primary_itr = participants.find(participant_itr->primary_key());
    participants.modify(primary_itr, RamPayer::of(participants), [&](auto& p) {
        p.queued_withdrawal += amount;
        p.share_balance -= amount; // Remove from share balance so it stops earning
    });

    // Update global state
    gs.total_shares -= amount; // Remove from total shares
    update_global_state(gs);

    // Process withdrawals
    process_withdrawals(coopname);
}

void contributor::addfee(name coopname, asset amount) {
    require_auth(_self); // Only the contract account can call this action
    check(amount.symbol == TOKEN_SYMBOL, "Invalid token symbol");
    check(amount.is_valid(), "Invalid asset");
    check(amount.amount > 0, "Amount must be positive");

    auto gs = get_global_state(coopname);

    gs.accumulated_fees += amount;
    update_global_state(gs);

    // Process withdrawals after adding fees
    process_withdrawals(coopname);
}

void contributor::process_withdrawals(const name& coopname) {
    auto gs = get_global_state(coopname);

    withdrawals_table withdrawals(_self, _self.value);
    auto by_timestamp = withdrawals.get_index<"bytimestamp"_n>();

    for (auto itr = by_timestamp.begin(); itr != by_timestamp.end() && gs.accumulated_fees.amount > 0;) {
        if (gs.accumulated_fees.amount >= itr->amount.amount) {
            // Enough fees to cover the withdrawal
            gs.accumulated_fees -= itr->amount;

            // Transfer funds to user
            action(
                permission_level{_self, "active"_n},
                "eosio.token"_n,
                "transfer"_n,
                std::make_tuple(_self, itr->account, itr->amount, std::string("Membership fee withdrawal"))
            ).send();

            // Update participant's queued_withdrawal
            participants_table participants(_self, _self.value);
            auto idx = participants.get_index<"byaccount"_n>();
            auto participant_itr = idx.find(itr->account.value);
            if (participant_itr != idx.end()) {
                auto primary_itr = participants.find(participant_itr->primary_key());
                participants.modify(primary_itr, RamPayer::of(participants), [&](auto& p) {
                    p.queued_withdrawal -= itr->amount;
                });
            }

            // Erase the withdrawal request
            itr = by_timestamp.erase(itr);
        } else {
            // Not enough fees to cover this withdrawal, stop processing
            break;
        }
    }

    // Update global state
    update_global_state(gs);
}

void contributor::refresh(name coopname, name username) {
    require_auth(username);

    auto gs = get_global_state(coopname);

    // Participants table
    participants_table participants(_self, _self.value);
    auto idx = participants.get_index<"byaccount"_n>();
    auto participant_itr = idx.find(username.value);
    check(participant_itr != idx.end(), "Participant not found");

    auto participant = *participant_itr;

    int64_t participant_delta = gs.cumulative_reward_per_share - participant.reward_per_share_last;
    if (participant_delta == 0) {
        // No update needed
        return;
    }

    int64_t reward_amount_int = participant.share_balance.amount * participant_delta;
    asset reward_amount = asset(reward_amount_int, TOKEN_SYMBOL);

    // Update participant data
    auto primary_itr = participants.find(participant_itr->primary_key());
    participants.modify(primary_itr, RamPayer::of(participants), [&](auto& p) {
        p.pending_rewards += reward_amount;
        p.reward_per_share_last = gs.cumulative_reward_per_share;
        p.share_balance += reward_amount;
    });
}


void contributor::process_intellectual(const name & coopname, const name& username, const asset& amount) {
    auto gs = get_global_state(coopname);

    // Participants table
    participants_table participants(_self, _self.value);

    // Calculate distribution amount (multiply by 1.618)
    int64_t distribution_amount_int = (amount.amount * 1618) / 1000;
    asset distribution_amount = asset(distribution_amount_int, TOKEN_SYMBOL);

    int64_t cumulative_reward_per_share = gs.cumulative_reward_per_share;
    
    if (gs.total_shares.amount > 0) {
        int64_t delta = distribution_amount_int / gs.total_shares.amount;
        cumulative_reward_per_share += delta;

        // Update global state
        gs.cumulative_reward_per_share = cumulative_reward_per_share;
        gs.total_rewards_distributed += distribution_amount;
        gs.total_shares += amount + distribution_amount;
        gs.total_contributions += amount;
        gs.total_intellectual_contributions += amount;
        update_global_state(gs);
    } else {
        gs.total_shares += amount;
        gs.total_contributions += amount;
        gs.total_intellectual_contributions += amount;
        update_global_state(gs);
    }

    // Update participant data
    auto idx = participants.get_index<"byaccount"_n>();
    auto participant_itr = idx.find(username.value);
    check(participant_itr != idx.end(), "Participant not found");
    auto primary_itr = participants.find(participant_itr->primary_key());
    participants.modify(primary_itr, RamPayer::of(participants), [&](auto& p) {
        p.share_balance += amount;
        p.intellectual_contributions += amount;
        p.total_contributions += amount;
        // Update participant's reward_per_share_last
        p.reward_per_share_last = gs.cumulative_reward_per_share;
    });
}

void contributor::process_property(const name& coopname, const name& username, const asset& amount) {
    auto gs = get_global_state(coopname);

    // Participants table
    participants_table participants(_self, _self.value);
    auto idx = participants.get_index<"byaccount"_n>();
    auto participant_itr = idx.find(username.value);
    check(participant_itr != idx.end(), "Participant not found");

    // Update participant data
    auto primary_itr = participants.find(participant_itr->primary_key());
    participants.modify(primary_itr, RamPayer::of(participants), [&](auto& p) {
        p.share_balance += amount;
        p.property_contributions += amount;
        p.total_contributions += amount;
    });

    // Update global state
    gs.total_shares += amount;
    gs.total_contributions += amount;
    gs.total_property_contributions += amount;
    update_global_state(gs);
}

