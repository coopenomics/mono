import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type {
  ExtensionSchemaMigrationAfterContext,
  IExtensionSchemaMigration,
} from '@coopenomics/extension-kit';
import { IConfig } from '../types';
import { MarketplaceReturnClaimStatuses } from '../domain/entities/marketplace-return-claim.types';

/**
 * Статус заявления на гарантийный возврат до перехода на решение совета: имущество
 * принято у стойки и движения отменены сразу. В перечне статусов его больше нет.
 */
const LEGACY_ACCEPTED_AT_VISIT = 'ACCEPTED_AT_VISIT';

/**
 * Bootstrap-миграция v22 расширения `market` — заявления на гарантийный возврат
 * со снятым статусом `ACCEPTED_AT_VISIT` переводятся в `ACCEPTED_BY_COUNCIL`.
 *
 * Зачем: паевая модель (задача 99D-7) заменила приём у стойки с немедленной
 * отменой движений на приём у стойки и решение совета. Итоговый статус
 * «возврат принят, движения отменены» стал `ACCEPTED_BY_COUNCIL` — снапшот
 * отката движений прежде хранился «только при ACCEPTED_AT_VISIT», теперь
 * «только при ACCEPTED_BY_COUNCIL». Миграции данных тогда не было, и заявления,
 * принятые до переезда, остались со старым значением: GraphQL не может отдать
 * его в перечне `MarketplaceReturnClaimStatus` и роняет весь список на странице
 * «Гарантийные возвраты» (тестнет, 11.09.2026).
 *
 * Остальные значения перечня тем же переездом не менялись.
 *
 * Идемпотентна: трогает только строки со старым значением.
 */
export const marketplaceBootstrapV22Migration: IExtensionSchemaMigration<Partial<IConfig>, IConfig> = {
  extensionName: 'market',
  version: 22,

  migrate(oldConfig, def) {
    return { ...def, ...oldConfig };
  },

  async afterMigrate(ctx: ExtensionSchemaMigrationAfterContext): Promise<void> {
    const dataSource = ctx.resolve<DataSource>(getDataSourceToken('marketplace') as string | symbol);
    if (!dataSource) return;

    const result: unknown = await dataSource.query(
      `UPDATE marketplace_return_claim SET status = $1 WHERE status = $2 RETURNING id`,
      [MarketplaceReturnClaimStatuses.ACCEPTED_BY_COUNCIL, LEGACY_ACCEPTED_AT_VISIT]
    );
    // Драйвер postgres в TypeORM отдаёт на UPDATE … RETURNING пару [строки, счётчик].
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : Array.isArray(result) ? result : [];

    if (rows.length > 0) {
      ctx.logInfo(
        `Заявления на гарантийный возврат со снятым статусом ${LEGACY_ACCEPTED_AT_VISIT} переведены в ` +
          `${MarketplaceReturnClaimStatuses.ACCEPTED_BY_COUNCIL}: ${rows.length}.`
      );
    }
  },
};
