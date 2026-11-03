import { MarketplaceBaseline1790197276758 } from './migrations/database/1790197276758-baseline';
import { MarketplaceDropFirstVersionCatalog1791028868299 } from './migrations/database/1791028868299-drop-first-version-catalog';
import { MarketplaceHandoffCode1791736800000 } from './migrations/database/1791736800000-handoff-code';
import { MarketplaceSecureDue1793440000000 } from './migrations/database/1793440000000-secure-due';
import { MarketplaceIssuanceStepClaim1793480000000 } from './migrations/database/1793480000000-issuance-step-claim';
import { MarketplaceSupplierProfileAndReview1791619859005 } from './migrations/database/1791619859005-supplier-profile-and-review';
import { MarketplaceOrderReviewInvite1791723152953 } from './migrations/database/1791723152953-order-review-invite';
import { MarketplaceKeuPeriod1793520000000 } from './migrations/database/1793520000000-keu-period';

/**
 * Миграции таблиц расширения — в порядке появления (метка времени в имени
 * класса). Объявляются в записи реестра (`databaseMigrations`) рядом с
 * сущностями, и файлы лежат здесь же: вынесенное расширение уносит историю
 * своих таблиц с собой. Новую миграцию `pnpm schema:generate` дописывает сюда.
 */
export const marketplaceDatabaseMigrations = [
  MarketplaceBaseline1790197276758,
  MarketplaceDropFirstVersionCatalog1791028868299,
  MarketplaceHandoffCode1791736800000,
  MarketplaceSecureDue1793440000000,
  MarketplaceIssuanceStepClaim1793480000000,
  MarketplaceSupplierProfileAndReview1791619859005,
  MarketplaceOrderReviewInvite1791723152953,
  MarketplaceKeuPeriod1793520000000,
];
