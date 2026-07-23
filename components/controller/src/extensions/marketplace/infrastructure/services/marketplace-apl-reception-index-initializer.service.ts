import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Partial unique-индексы АПП приёмки: одна АКТИВНАЯ приёмка на партию / ТТН.
 *
 * `cancelReception` переводит акт в CANCELLED и возвращает партию в
 * SUPPLY_PREPARED — повторный create должен пройти. `findByShipmentId` уже
 * исключает CANCELLED, но absolute unique `(coopname, shipment_id)` оставлял
 * отменённую строку и ломал INSERT (`IDX_marketplace_apl_reception_shipment_unique`).
 *
 * TypeORM `@Index({ where })` при synchronize индекс не пересоздаёт надёжно
 * (см. UserWalletIndexInitializer) — DDL явно при старте.
 */
@Injectable()
export class MarketplaceAplReceptionIndexInitializer implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(MarketplaceAplReceptionIndexInitializer.name);
  }

  async onModuleInit(): Promise<void> {
    await this.ensureIndex({
      name: 'IDX_marketplace_apl_reception_shipment_unique',
      mustContain: "status <> 'CANCELLED'",
      createSql: `CREATE UNIQUE INDEX "IDX_marketplace_apl_reception_shipment_unique" ON marketplace_apl_reception (coopname, shipment_id) WHERE status <> 'CANCELLED'`,
    });
    await this.ensureIndex({
      name: 'IDX_marketplace_apl_reception_ttn_unique',
      mustContain: "ttn_number IS NOT NULL AND status <> 'CANCELLED'",
      createSql: `CREATE UNIQUE INDEX "IDX_marketplace_apl_reception_ttn_unique" ON marketplace_apl_reception (coopname, ttn_number) WHERE ttn_number IS NOT NULL AND status <> 'CANCELLED'`,
    });
  }

  private async ensureIndex(opts: {
    name: string;
    /** Подстрока, которая должна быть в indexdef после нормализации. */
    mustContain: string;
    createSql: string;
  }): Promise<void> {
    const rows: Array<{ indexdef: string }> = await this.dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = $1`,
      [opts.name]
    );
    const current = rows[0]?.indexdef ?? null;
    // PG может обернуть колонки в `(status)::text` — сравниваем по смыслу WHERE.
    if (current && this.normalize(current).includes(this.normalize(opts.mustContain))) return;

    this.logger.log(
      `Пересоздание ${opts.name} как partial unique (текущий: ${current ?? '<нет>'})`
    );
    await this.dataSource.query(`DROP INDEX IF EXISTS "${opts.name}"`);
    await this.dataSource.query(opts.createSql);
  }

  private normalize(def: string): string {
    return def
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/::text/g, '')
      .replace(/[()"]/g, '')
      .trim();
  }
}
