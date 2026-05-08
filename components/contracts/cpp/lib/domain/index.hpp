#pragma once

// Агрегатор определений таблиц и связанных domain-заголовков (раньше — drafts/accounts/coops/… в корне lib).

// drafts
#include "document_core.hpp"
#include "table_draft_drafts.hpp"
#include "table_draft_translations.hpp"

// accounts (registrator)
#include "account_payer.hpp"
#include "org_data.hpp"
#include "registrator_account_access.hpp"
#include "table_registrator_accounts.hpp"
#include "table_registrator_coops.hpp"
#include "table_registrator_orgs.hpp"
#include "table_registrator_verification.hpp"
#include "table_registrator_candidates.hpp"
#include "table_registrator_candidates_legacy.hpp"

// coops (soviet)
#include "coops_access_helpers.hpp"
#include "table_soviet_addresses.hpp"
#include "table_soviet_boards.hpp"
#include "table_soviet_decisions.hpp"
#include "table_soviet_participants.hpp"
#include "table_soviet_staff.hpp"
#include "table_soviet_approvals.hpp"

#include "table_counts.hpp"

#include "permissions.hpp"
#include "rammarket.hpp"

#include "table_balances_balances.hpp"
#include "table_soviet_progwallets.hpp"

#include "table_soviet_agreements.hpp"
#include "table_soviet_agreements3.hpp"
#include "table_soviet_coagreements.hpp"
#include "table_soviet_programs.hpp"

#include "table_fund_accfunds.hpp"
#include "table_fund_coopwallet.hpp"
#include "table_fund_expfunds.hpp"
#include "table_fund_fwithdraws.hpp"

#include "table_branch_branches.hpp"
#include "table_branch_branchstat.hpp"

// wallet / gateway / ledger / loan / marketplace
#include "table_wallet_deposits.hpp"
#include "table_wallet_users.hpp"
#include "table_wallet_withdraws.hpp"
#include "table_gateway_incomes.hpp"
#include "table_gateway_outcomes.hpp"
#include "table_ledger_laccount.hpp"
#include "table_ledger_writeoffs.hpp"
#include "table_ledger2_wallet.hpp"
#include "table_ledger2_account.hpp"
#include "table_ledger2_userwallets.hpp"
// Epic 1 addendum (2026-04-18): journal+wjournal удалены из RAM; история
// собирается на бэкенде из blockchain_actions[ledger2::apply/walletop/debit/credit]
// и blockchain_deltas[ledger2::accounts/wallets].
#include "table_ledger2_meta.hpp"
#include "table_loan_debts.hpp"
#include "table_loan_summaries.hpp"
#include "table_marketplace_requests.hpp"
#include "table_marketplace_segments.hpp"
#include "table_marketplace_shipments.hpp"

// apps (каталог приложений)
#include "table_apps_packages.hpp"
#include "table_apps_releases.hpp"
#include "table_apps_subs.hpp"
#include "table_apps_coops.hpp"
