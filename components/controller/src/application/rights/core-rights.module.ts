import { Module } from '@nestjs/common';
import { APP_RIGHTS, RightsGuard } from '@coopenomics/extension-kit';
import { CoreRights } from './core-rights';
import { PROCESS_JOURNAL_PORT } from '~/domain/process-registry/ports/process-journal.port';
import { ProcessJournalKyselyRepository } from '~/infrastructure/database/kysely/repositories/process-journal.kysely-repository';

/**
 * Права ядра (C28-87). Модуль ядра, чьи операции стоят под общим гардом
 * (`@UseGuards(GqlJwtAuthGuard, RightsGuard)` + `@RequireRight`), импортирует
 * этот модуль: гард берёт из него описание прав ядра. Расширения объявляют
 * собственное описание в своём модуле.
 */
@Module({
  providers: [
    CoreRights,
    { provide: APP_RIGHTS, useExisting: CoreRights },
    RightsGuard,
    // Участников процесса справочник прав читает из журнала цепи напрямую:
    // сервис реестра процессов тянет модуль документов, а права нужны везде.
    { provide: PROCESS_JOURNAL_PORT, useClass: ProcessJournalKyselyRepository },
  ],
  exports: [CoreRights, APP_RIGHTS, RightsGuard],
})
export class CoreRightsModule {}
