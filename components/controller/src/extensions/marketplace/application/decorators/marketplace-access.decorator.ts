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
  /**
   * Одно действие или список — тогда guard пропускает, если роль
   * удовлетворяет ХОТЯ БЫ ОДНОМУ из них (OR). Нужен там, где один и тот же
   * резолвер сам разруливает ownership для разных ролей (например,
   * `marketplaceReturnClaim`: заказчик читает своё по `read:own`,
   * председатель КУ — по `read:own-KU`) — guard проверяет только «эта роль
   * вообще может читать resource хоть в какой-то форме», а не то, какую
   * именно форму, это делает сам резолвер.
   */
  action: string | string[];
}

export const RequireMarketplaceAccess = (resource: string, action: string | string[]) =>
  SetMetadata<string, IMarketplaceAccessRequirement>(MARKETPLACE_ACCESS_METADATA_KEY, {
    resource,
    action,
  });
