import { Inject, Injectable } from '@nestjs/common';
import { TableStore } from '@coopenomics/extension-kit';
import { MARKETPLACE_SECURE_DUE_STORE } from './marketplace-stores';
import type { MarketplaceSecureDueEntity } from '../entities/marketplace-secure-due.entity';

/** Суммы строк учёта: стоимость заказов, обеспечительная часть к списанию, число строк. Суммы — десятичные строки базы. */
export interface SecureDueTotals {
  turnover: string;
  secured: string;
  rows: number;
}

/**
 * Суммы по строкам учёта обеспечительной части — считает база, а не узел.
 *
 * Строк у кооператива десятки тысяч в месяц: итог месяца участка и сводка
 * «созреют к первому числу» берутся одним запросом с суммами, в память узла
 * строки не загружаются. Отбор и отметки строк идут через шлюз таблицы, здесь
 * только то, что шлюз не умеет: `SUM`, `COUNT` и перечень участков.
 */
@Injectable()
export class MarketplaceSecureDueRunQueries {
  constructor(
    @Inject(MARKETPLACE_SECURE_DUE_STORE)
    private readonly store: TableStore<MarketplaceSecureDueEntity>
  ) {}

  /**
   * Участки, у которых есть заказы со стоимостью, созревшие к списанию до
   * момента `before` и не отправленные в цепь, — участки прогона.
   */
  async ripeBranches(coopname: string, before: Date): Promise<string[]> {
    const rows = await this.store
      .sqlBuilder('d')
      .select('d.braname', 'braname')
      .distinct()
      .where('d.coopname = :coopname', { coopname })
      .andWhere('d.charged_at IS NULL AND d.charge_sent_at IS NULL')
      .andWhere('d.due_from < :before', { before })
      .andWhere('d.base_amount > 0 AND d.due_amount > 0')
      .orderBy('d.braname', 'ASC')
      .getRawMany<{ braname: string }>();
    return rows.map((row) => String(row.braname));
  }

  /** Суммы списка прогона участка: строки с номером прогона, ещё не списанные и не отправленные. */
  async runTotals(coopname: string, braname: string, period: number): Promise<SecureDueTotals> {
    const row = await this.totals()
      .where('d.coopname = :coopname AND d.braname = :braname', { coopname, braname })
      .andWhere('d.run_period = :period', { period })
      .andWhere('d.charged_at IS NULL AND d.charge_sent_at IS NULL AND d.due_amount > 0')
      .getRawOne<{ turnover: string; secured: string; rows: string }>();
    return this.toTotals(row);
  }

  /**
   * Суммы заказов участка, которые созреют к списанию до момента `before`:
   * выданы, не списаны, гарантийный срок кончается раньше.
   */
  async ripeningTotals(coopname: string, braname: string, before: Date): Promise<SecureDueTotals> {
    const row = await this.totals()
      .where('d.coopname = :coopname AND d.braname = :braname', { coopname, braname })
      .andWhere('d.charged_at IS NULL AND d.due_amount > 0')
      .andWhere('d.due_from < :before', { before })
      .getRawOne<{ turnover: string; secured: string; rows: string }>();
    return this.toTotals(row);
  }

  private totals() {
    return this.store
      .sqlBuilder('d')
      .select('COALESCE(SUM(d.base_amount), 0)', 'turnover')
      .addSelect('COALESCE(SUM(d.due_amount), 0)', 'secured')
      .addSelect('COUNT(*)', 'rows');
  }

  private toTotals(row: { turnover: string; secured: string; rows: string } | undefined): SecureDueTotals {
    return { turnover: String(row?.turnover ?? '0'), secured: String(row?.secured ?? '0'), rows: Number(row?.rows ?? 0) };
  }
}
