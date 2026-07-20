#include <array>

/**
 * @brief Миграция данных системы
 * Выполняет миграцию данных системы при обновлении контракта.
 * Вызывается автоматически в CI/CD при каждом деплое.
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void soviet::migrate() {
    require_auth(_soviet); // Проверяем авторизацию

    // Откат program_type для кооператива voskhod, программа id=4: blagorost -> capital.
    // Предыдущая версия этой миграции переименовывала programs.program_type в
    // 'blagorost', но coagreements.type для той же программы (program_id=4) всегда
    // оставался 'capital' и никогда не переименовывался — таблицы разъехались.
    // 'capital' — каноничное значение (используется coagreements.type, contract-
    // константой _capital_program и всем controller-кодом); эта миграция приводит
    // programs.program_type к нему же. Идемпотентно.
    {
        eosio::name coopname = "voskhod"_n;
        programs_index programs(_soviet, coopname.value);
        auto program_it = programs.find(4);
        if (program_it != programs.end() && program_it->program_type != "capital"_n) {
            programs.modify(program_it, _soviet, [&](auto &pr) {
                pr.program_type = "capital"_n;
            });
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Разовая очистка ФАНТОМНЫХ участников кооператива fgrtejiwnynn (инцидент
    // 2026-06-04). Удаляем строки soviet::participants для 6 дублей-аккаунтов,
    // оставшихся на цепи после 3-кратного прогона install.interactor (см.
    // ~/gorozhane-dup-install-cleanup.md). Эти участники не голосовали и не
    // входят в совет (createboard для них не выполнялся).
    //
    // Список username синхронизирован с registrator::migrate и ledger2::migrate.
    // Дедуп-гард: удаляем фантомов ТОЛЬКО если в коопе остаётся хотя бы один
    // НЕ-фантомный участник (никогда не опустошаем реестр). Идемпотентно.
    {
        const eosio::name PHANTOM_COOP = "fgrtejiwnynn"_n;
        const std::array<eosio::name, 6> PHANTOMS = {
            "bbsezpgufvmm"_n, "errwcgjwverm"_n, "hcfsluqsfehw"_n,
            "kgkzdadfpzki"_n, "nzuyijobapsv"_n, "tplwfwbujugq"_n,
        };

        auto is_phantom = [&](eosio::name u) {
            for (const auto& p : PHANTOMS) if (p == u) return true;
            return false;
        };

        participants_index participants(_soviet, PHANTOM_COOP.value);

        // Гарантируем, что после удаления останется ≥1 реальный участник.
        uint64_t real_participants = 0;
        for (auto it = participants.begin(); it != participants.end(); ++it) {
            if (!is_phantom(it->username)) real_participants++;
        }

        if (real_participants > 0) {
            for (const auto& u : PHANTOMS) {
                auto it = participants.find(u.value);
                if (it != participants.end()) {
                    participants.erase(it);
                }
            }
        }
    }


    // Старый код миграции (закомментирован)
    // cooperatives2_index coops(_registrator, _registrator.value);

    // for (auto coop_it = coops.begin(); coop_it != coops.end(); ++coop_it) {
    //     eosio::name coopname = coop_it->username;

    //     participants_index participants(_soviet, coopname.value);
    //     wallets_index wallets(_soviet, coopname.value);
    //     progwallets_index progwallets(_soviet, coopname.value);
    //     programs_index programs(_soviet, coopname.value);

    //     eosio::asset total_available(0, _root_govern_symbol); // Итоговая сумма available

    //     for (auto part_it = participants.begin(); part_it != participants.end(); ++part_it) {
    //         eosio::name username = part_it->username;

    //         // Получаем кошелек участника из wallets
    //         auto wallet_it = wallets.find(username.value);
    //         if (wallet_it != wallets.end()) {
    //             eosio::asset available_balance = wallet_it->available;
    //             eosio::asset minimum_balance = wallet_it->minimum;
    //             eosio::asset initial_balance = wallet_it->initial.value();

    //             // Обновляем progwallets
    //             auto user_prog_wallets = progwallets.get_index<"byusername"_n>();
    //             auto prog_wallet_it = user_prog_wallets.lower_bound(username.value);

    //             while (prog_wallet_it != user_prog_wallets.end() && prog_wallet_it->username == username) {
    //                 user_prog_wallets.modify(prog_wallet_it, _soviet, [&](auto &w) {
    //                     w.available = available_balance;
    //                 });

    //                 total_available += available_balance; // Добавляем к общей сумме

    //                 ++prog_wallet_it;
    //             }

    //             // Обновляем participant
    //             participants.modify(part_it, _soviet, [&](auto &p) {
    //                 p.minimum_amount = minimum_balance;
    //                 p.initial_amount = initial_balance;
    //             });
    //         }
    //     }

    //     // Обновляем available у программы с id=1
    //     auto program_it = programs.find(1);
    //     if (program_it != programs.end()) {
    //         programs.modify(program_it, _soviet, [&](auto &pr) {
    //             pr.available = total_available;
    //             pr.blocked = asset(0, _root_govern_symbol);
    //             pr.share_contributions = total_available;
    //         });
    //     }
    // }
}