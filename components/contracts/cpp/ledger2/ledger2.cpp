#include "ledger2.hpp"

#include <eosio/transaction.hpp>

#include "src/common/apply.cpp"
#include "src/common/walletop.cpp"
#include "src/common/debit.cpp"
#include "src/common/credit.cpp"
#include "src/migrate/migrate.cpp"
#include "src/migrate/migrate3.cpp"
#include "src/adjust/walmove.cpp"
#include "src/adjust/revert.cpp"
