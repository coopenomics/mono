import { Module } from '@nestjs/common';
import { APP_RIGHTS, RightsGuard } from '@coopenomics/extension-kit';
import { CoreRights } from './core-rights';

/**
 * Права ядра (C28-87). Модуль ядра, чьи операции стоят под общим гардом
 * (`@UseGuards(GqlJwtAuthGuard, RightsGuard)` + `@RequireRight`), импортирует
 * этот модуль: гард берёт из него описание прав ядра. Расширения объявляют
 * собственное описание в своём модуле.
 */
@Module({
  providers: [CoreRights, { provide: APP_RIGHTS, useExisting: CoreRights }, RightsGuard],
  exports: [CoreRights, APP_RIGHTS, RightsGuard],
})
export class CoreRightsModule {}
