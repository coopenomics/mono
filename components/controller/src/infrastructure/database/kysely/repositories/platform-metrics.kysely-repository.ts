import { Inject, Injectable } from '@nestjs/common';
import { KYSELY, type Database } from '../kysely.tokens';
import { rawQuery } from '@coopenomics/extension-kit';
import { userStatus } from '~/types/user.types';
import { CandidateStatus } from '~/domain/registration/enum';
import { NotificationOutboxStatus } from '~/domain/notification/interfaces/notification-outbox.domain.interface';
import type { PlatformMetricsPort, PlatformMetricsSnapshot } from '~/domain/metrics/ports/platform-metrics.port';

/**
 * Читает прикладные показатели кооператива для Prometheus.
 *
 * ЗАПРОСЫ НАПИСАНЫ ТЕКСТОМ SQL, а не построителем, намеренно: здесь нужны
 * только агрегаты, ни одна сущность не материализуется, и группировка по одной
 * колонке читается как есть. Таблицы `users`, `candidates` и
 * `notification_outbox` — ядро схемы, они не переименовывались ни разу.
 *
 * `::int` обязателен: PostgreSQL отдаёт `count(*)` типом bigint, а драйвер
 * возвращает bigint СТРОКОЙ, чтобы не терять точность. Без приведения в Gauge
 * уехала бы строка, prom-client записал бы NaN, и метрика молча исчезла бы из
 * выдачи.
 */
/** Строка агрегата «значение колонки status — число строк»: это ключ группировки, а не статус сущности. */
type StatusCount = Record<'status', string> & { count: number };

@Injectable()
export class PlatformMetricsKyselyRepository implements PlatformMetricsPort {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async collect(): Promise<PlatformMetricsSnapshot> {
    const [usersByStatus, usersWithAccountFlag, usersWithChainKey, chainParticipants, candidatesByStatus, notificationOutboxByStatus] =
      await Promise.all([
        this.countUsersByStatus(),
        this.countScalar('select count(*)::int as count from users where has_account = true'),
        this.countScalar("select count(*)::int as count from users where public_key <> ''"),
        this.countChainParticipants(),
        this.countCandidatesByStatus(),
        this.countOutboxByStatus(),
      ]);

    return {
      usersByStatus,
      usersWithAccountFlag,
      usersWithChainKey,
      chainParticipants,
      candidatesByStatus,
      notificationOutboxByStatus,
    };
  }

  private async countUsersByStatus(): Promise<Record<string, number>> {
    const rows = await rawQuery<StatusCount>(
      this.db,
      'select status, count(*)::int as count from users group by status'
    );
    return this.withZeroes(rows, Object.values(userStatus));
  }

  private async countScalar(sql: string): Promise<number> {
    const rows = await rawQuery<{ count: number }>(this.db, sql);
    return rows[0]?.count ?? 0;
  }

  /**
   * Пайщики по самой цепи: живые строки `soviet::participants` в журнале дельт.
   * `present = false` — строка, удалённая из таблицы контракта, её считать
   * нельзя. Индекс (code, "table") делает выборку пропорциональной числу
   * пайщиков, а не размеру журнала.
   */
  private async countChainParticipants(): Promise<number> {
    return this.countScalar(
      `select count(*)::int as count from blockchain_deltas
       where code = 'soviet' and "table" = 'participants' and present = true`
    );
  }

  private async countCandidatesByStatus(): Promise<Record<string, number>> {
    const rows = await rawQuery<StatusCount>(
      this.db,
      'select status, count(*)::int as count from candidates group by status'
    );
    return this.withZeroes(rows, Object.values(CandidateStatus));
  }

  private async countOutboxByStatus(): Promise<Record<string, number>> {
    const rows = await rawQuery<StatusCount>(
      this.db,
      'select status, count(*)::int as count from notification_outbox group by status'
    );
    return this.withZeroes(rows, Object.values(NotificationOutboxStatus));
  }

  /**
   * Досыпает нули по всем известным значениям перечисления.
   *
   * Без этого статус, по которому строк не осталось, просто пропадал бы из
   * выдачи — а на дашборде и в правиле алертинга «нет ряда» и «ноль» это разные
   * вещи: правило вида `> 0` по исчезнувшему ряду не сработает никогда.
   */
  private withZeroes(rows: StatusCount[], known: string[]): Record<string, number> {
    const result: Record<string, number> = Object.fromEntries(known.map((s) => [s, 0]));
    for (const row of rows) {
      result[row.status ?? 'unknown'] = Number(row.count);
    }
    return result;
  }
}
