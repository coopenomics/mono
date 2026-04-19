import { Injectable } from '@nestjs/common';
import { ReportType } from '../enums/report-type.enum';
import type { LedgerAccountData } from '../interfaces/report-generator.interface';
import { toThousands } from '../../infrastructure/generators/buhotch.generator';

export interface PreviewSection {
  title: string;
  fields: Array<{ key: string; label: string; value?: string; unit?: string }>;
}

export interface PreviewContext {
  reportType: ReportType;
  year: number;
  period?: number;
  ledgerData: LedgerAccountData[];
  corrections: Map<string, { prev: number; pre: number }>;
}

/**
 * Препоказ полей отчёта БЕЗ рендера XML: именно то, что увидит
 * председатель в форме перед нажатием «Сгенерировать».
 *
 * Для BUHOTCH — строки баланса с уже рассчитанными суммами (в тыс. рублей).
 * Для нулевых (NDFL6/RSV/DUSN/FSS4) — перечень реквизитов и ключевых полей,
 * в которых проставлены нули.
 */
// Используем `toThousands` из generator — единый источник правды для
// округления в тысячи рублей. Preview и XML обязаны показывать одинаковые числа.
const round1000 = toThousands;

// Epic 1 addendum (2026-04-18): субсчета 86.x удалены, детализация в wallets.
const ACCOUNT_GROUPS = {
  cash: [50000, 51000, 52000, 55000],
  nonMatFin: [1000, 4000, 8000, 583000],
  shortFin: [58000, 581000, 582000, 62000, 76000],
  target: [80000, 86000],
} as const;

@Injectable()
export class ReportPreviewService {
  build(ctx: PreviewContext): PreviewSection[] {
    switch (ctx.reportType) {
      case ReportType.BUHOTCH:
        return this.buildBuhotch(ctx);
      case ReportType.NDFL6:
        return this.buildNdfl6(ctx);
      case ReportType.RSV:
        return this.buildRsv(ctx);
      case ReportType.DUSN:
        return this.buildDusn(ctx);
      case ReportType.FSS4:
        return this.buildFss4(ctx);
      default:
        return [];
    }
  }

  private buildBuhotch(ctx: PreviewContext): PreviewSection[] {
    const sumFor = (ids: readonly number[]) =>
      ctx.ledgerData.filter((a) => ids.includes(a.accountId)).reduce((s, a) => s + a.balanceCurrent, 0);

    const nonMatFin = sumFor(ACCOUNT_GROUPS.nonMatFin);
    const cash = sumFor(ACCOUNT_GROUPS.cash);
    const shortFin = sumFor(ACCOUNT_GROUPS.shortFin);
    const target = sumFor(ACCOUNT_GROUPS.target);

    const assetsTotal = nonMatFin + cash + shortFin;

    const corrForDisplayIds = (displayIds: string[]) => {
      let prev = 0;
      let pre = 0;
      for (const id of displayIds) {
        const c = ctx.corrections.get(id);
        if (c) {
          prev += c.prev;
          pre += c.pre;
        }
      }
      return { prev, pre };
    };

    // Соответствие числовых groups и display-id, по которым ищутся корректировки.
    const nonMatFinCorr = corrForDisplayIds(['01', '04', '08', '58.3']);
    const cashCorr = corrForDisplayIds(['50', '51', '52', '55']);
    const shortFinCorr = corrForDisplayIds(['58', '58.1', '58.2', '62', '76']);
    const targetCorr = corrForDisplayIds(['80', '86', '86.01', '86.02', '86.03', '86.04', '86.05', '86.06', '86.07', '86.8']);

    const row = (label: string, current: number, corr: { prev: number; pre: number }) => ({
      key: label,
      label,
      value: `Отч: ${round1000(current)} тыс.; Прдщ: ${round1000(corr.prev)} тыс.; Прдшв: ${round1000(corr.pre)} тыс.`,
      unit: 'тыс. ₽',
    });

    return [
      {
        title: 'Актив баланса (КНД 0710001)',
        fields: [
          row('Нематериальные, финансовые и др. внеоборотные активы', nonMatFin, nonMatFinCorr),
          row('Денежные средства', cash, cashCorr),
          row('Финансовые и другие оборотные активы', shortFin, shortFinCorr),
          {
            key: 'totalAssets',
            label: 'Итого активы',
            value: String(round1000(assetsTotal)),
            unit: 'тыс. ₽',
          },
        ],
      },
      {
        title: 'Пассив баланса',
        fields: [
          row('Целевые средства (паевой фонд + целевые поступления)', target, targetCorr),
          {
            key: 'totalPassives',
            label: 'Итого пассивы',
            value: String(round1000(target)),
            unit: 'тыс. ₽',
          },
        ],
      },
      {
        title: 'Сверка',
        fields: [
          {
            key: 'balanceCheck',
            // ФНС регламент 0710096 допускает расхождение Актив=Пассив до 1 тыс. ₽
            // из-за независимого округления каждой строки. Строгое сравнение
            // `===` показывало ложное «Нет» при валидных отчётах.
            label: 'Актив = Пассив',
            value: (() => {
              const delta = round1000(assetsTotal) - round1000(target);
              if (Math.abs(delta) <= 1) return 'Да';
              return `Нет (Δ = ${delta} тыс.)`;
            })(),
          },
        ],
      },
    ];
  }

  private buildNdfl6(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: '6-НДФЛ (КНД 1151100, ВерсФорм 5.05)',
        fields: [
          { key: 'period', label: 'Период', value: this.quarterLabel(ctx.period) },
          { key: 'year', label: 'Отчётный год', value: String(ctx.year) },
          { key: 'kbk', label: 'КБК', value: '18210102010011000110' },
          { key: 'rate', label: 'Ставка налога', value: '13 %' },
          { key: 'allZero', label: 'Все числовые показатели', value: '0 (нулевой отчёт)' },
        ],
      },
    ];
  }

  private buildRsv(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: 'РСВ (КНД 1151111, ВерсФорм 5.08)',
        fields: [
          { key: 'period', label: 'Период', value: this.quarterLabel(ctx.period) },
          { key: 'year', label: 'Отчётный год', value: String(ctx.year) },
          { key: 'body', label: 'Раздел РасчетСВ', value: 'Пустой (нулевой отчёт)' },
        ],
      },
    ];
  }

  private buildDusn(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: 'Декларация УСН (КНД 1152017, ВерсФорм 5.09)',
        fields: [
          { key: 'period', label: 'Период', value: '34 (годовой)' },
          // DN1 code review Chunk A: ctx.year = «год за который отчитываемся»,
          // единый контракт со всеми ФНС-генераторами. Раньше было ctx.year-1,
          // что рассинхронизировалось с генератором после унификации.
          { key: 'year', label: 'Отчётный год', value: String(ctx.year) },
          { key: 'obNal', label: 'Объект налогообложения', value: '1 (доходы)' },
          { key: 'rate', label: 'Ставка', value: '0 % (нулевой отчёт)' },
          { key: 'sum', label: 'Сумма налога', value: '0' },
        ],
      },
    ];
  }

  private buildFss4(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: 'ЕФС-1 (подраздел 2.1, в СФР)',
        fields: [
          { key: 'period', label: 'Период СФР', value: this.sfrPeriodLabel(ctx.period) },
          { key: 'year', label: 'Отчётный год', value: String(ctx.year) },
          { key: 'chisl', label: 'Среднесписочная численность', value: '0' },
          { key: 'tariff', label: 'Страховой тариф', value: '0.20' },
          { key: 'allSums', label: 'Все суммы', value: '0.00 (нулевой отчёт)' },
        ],
      },
    ];
  }

  private quarterLabel(q?: number): string {
    const map = { 1: 'I квартал (код 21)', 2: 'Полугодие (код 31)', 3: '9 месяцев (код 33)', 4: 'Год (код 34)' } as Record<number, string>;
    return q ? map[q] ?? `Квартал ${q}` : 'не указан';
  }

  private sfrPeriodLabel(q?: number): string {
    const map = { 1: 'I кв (03)', 2: 'Полугодие (06)', 3: '9 мес (09)', 4: 'Год (0)' } as Record<number, string>;
    return q ? map[q] ?? String(q) : 'не указан';
  }
}
