import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Инициализатор partial unique-индекса `idx_user_wallets_natural_key`
 * по `(coopname, wallet_name, username) WHERE present = true`.
 *
 * Контракт ledger2 удаляет L3-запись (`cleanup_l3_if_empty`) при обнулении
 * баланса; следующая операция на той же паре `(wallet_name, username)`
 * получит **новый** `id` (контракт берёт `available_primary_key()`). Если
 * postgres-mirror держит старую запись с `present=false` под full-set
 * unique-индексом, дельта новой записи проваливается с `duplicate key`.
 * `WHERE present = true` исключает удалённые из ограничения.
 *
 * TypeORM `@Index({ unique: true, where: '"present" = true' })` при
 * `synchronize: true` индекс не пересоздаёт (где-то теряет сравнение по
 * `WHERE`), поэтому DDL применяется здесь явно при старте.
 */
@Injectable()
export class UserWalletIndexInitializer implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(UserWalletIndexInitializer.name);
  }

  async onModuleInit(): Promise<void> {
    const indexname = 'idx_user_wallets_natural_key';
    const expectedDef =
      'CREATE UNIQUE INDEX idx_user_wallets_natural_key ON public.user_wallets USING btree (coopname, wallet_name, username) WHERE (present = true)';

    const rows: Array<{ indexdef: string }> = await this.dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = $1`,
      [indexname]
    );
    const current = rows[0]?.indexdef ?? null;

    if (current === expectedDef) return;

    this.logger.log(
      `Пересоздание ${indexname} как partial unique (текущий: ${current ?? '<нет>'})`
    );
    await this.dataSource.query(`DROP INDEX IF EXISTS ${indexname}`);
    await this.dataSource.query(
      `CREATE UNIQUE INDEX ${indexname} ON user_wallets (coopname, wallet_name, username) WHERE present = true`
    );
  }
}
