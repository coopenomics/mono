import { Inject, Injectable } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { PostgresFactoryStorage } from '@coopenomics/factory';
import { KYSELY } from '@coopenomics/extension-kit';

/**
 * Хранилище фабрики на базе контроллера: реализация живёт в пакете фабрики,
 * здесь — только соединение Kysely контроллера (шаг 5 фабрики v2).
 */
@Injectable()
export class PgFactoryStorage extends PostgresFactoryStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(@Inject(KYSELY) db: Kysely<any>) {
    super(db);
  }
}
