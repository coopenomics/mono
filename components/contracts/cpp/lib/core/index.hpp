#pragma once

/**
 * Кросс-контрактная логика общей библиотеки (вызовы, проверки, интеграции).
 * Порядок важен: таблицы — в domain/index.hpp, затем этот файл из lib/index.hpp.
 *
 * По смыслу аналогично capital/domain/core/: подпапки по подсистемам.
 */
#include "programs.hpp"
#include "auth.hpp"
#include "soviet/soviet.hpp"
#include "wallet/wallet.hpp"
#include "gateway/gateway.hpp"
#include "ledger/ledger.hpp"
#include "ledger2/ledger2.hpp"
#include "registrator/registrator.hpp"
#include "loan/loan.hpp"
#include "branch/branch.hpp"
#include "marketplace/marketplace.hpp"
