import { SetMetadata } from '@nestjs/common';

/**
 * `@RequireEduAccess('EduCourse', 'manage')` — требование к резолверу через
 * ресурс и действие из матрицы доступа (`edubridge-access-matrix.ts`).
 * Проверяет `EdubridgeAccessGuard`. Список действий — «хотя бы одно».
 */
export const EDUBRIDGE_ACCESS_METADATA_KEY = 'edubridge_access';

export interface IEdubridgeAccessRequirement {
  resource: string;
  action: string | string[];
}

export const RequireEduAccess = (resource: string, action: string | string[]) =>
  SetMetadata<string, IEdubridgeAccessRequirement>(EDUBRIDGE_ACCESS_METADATA_KEY, { resource, action });
