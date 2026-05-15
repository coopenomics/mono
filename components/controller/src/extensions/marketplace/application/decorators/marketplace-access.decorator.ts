import { SetMetadata } from '@nestjs/common';

/**
 * Story 1.8: декоратор `@RequireMarketplaceAccess('Resource', 'action')`.
 *
 * Альтернатива `@RequireMarketplaceRole(...)` (Story 1.6) — выражает требование
 * через ресурс+действие из централизованной access-matrix
 * (`marketplace-access-matrix.ts`). Используйте этот декоратор для нового
 * кода; `@RequireMarketplaceRole` остаётся для обратной совместимости и
 * для ситуаций, когда action не привязан к конкретному resource (например,
 * проверка членства в совете).
 *
 * `MarketplaceRoleGuard` читает оба декоратора и применяет любую совпавшую
 * семантику. Можно ставить оба, тогда guard потребует выполнения обоих.
 */
export const MARKETPLACE_ACCESS_METADATA_KEY = 'marketplace_access';

export interface IMarketplaceAccessRequirement {
  resource: string;
  action: string;
}

export const RequireMarketplaceAccess = (resource: string, action: string) =>
  SetMetadata<string, IMarketplaceAccessRequirement>(MARKETPLACE_ACCESS_METADATA_KEY, {
    resource,
    action,
  });
