import { SetMetadata } from '@nestjs/common';

import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';

/**
 * Метаданные decorator-а `@RequireMarketplaceRole('admin', 'board')`.
 *
 * Story 1.6: список marketplace-ролей, любая из которых даёт доступ к
 * методу (OR-семантика). `MarketplaceRoleGuard` читает массив через
 * `Reflector` и проверяет пересечение с `currentMember.marketplace_roles`.
 *
 * Если декоратор отсутствует — Guard разрешает (по аналогии с core
 * `RolesGuard`: «нет требования — нет ограничения»). Тогда защиту
 * обеспечивает только `MarketplaceMembershipGuard` (членство), а сам
 * resolver работает для всех ролей.
 */
export const MARKETPLACE_ROLES_METADATA_KEY = 'marketplace_roles';

export const RequireMarketplaceRole = (...roles: MarketplaceRole[]) =>
  SetMetadata(MARKETPLACE_ROLES_METADATA_KEY, roles);
