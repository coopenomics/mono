import { Injectable } from '@nestjs/common';
import { ReportType } from '../enums/report-type.enum';
import type { LedgerAccountData } from '../interfaces/report-generator.interface';
import { toThousands } from '../../infrastructure/generators/buhotch.generator';
import { t } from '../../i18n';

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
 *
 * КНД-коды и ВерсФорм в заголовках — **национальные идентификаторы форм
 * ФНС РФ** (Классификатор налоговых документов), одинаковы для всех
 * юрлиц и кооперативов: 0710001 — бухбаланс, 1151100 — 6-НДФЛ,
 * 1151111 — РСВ, 1151162 — ПСВ, 1152017 — декларация УСН, 1110355 —
 * уведомление об исчисленных суммах (УУСН/УВВ). Меняются только при
 * выпуске новой редакции XSD (приказ ФНС).
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
      value: t('reports.reportPreview.balanceRowValue', { current: round1000(current), prev: round1000(corr.prev), prePrev: round1000(corr.pre) }),
      unit: t('reports.reportPreview.thousandRubUnit'),
    });

    return [
      {
        title: t('reports.reportPreview.balanceAssetsTitle'),
        fields: [
          row(t('reports.reportPreview.nonMaterialFinAssetsLabel'), nonMatFin, nonMatFinCorr),
          row(t('reports.reportPreview.cashLabel'), cash, cashCorr),
          row(t('reports.reportPreview.shortTermFinAssetsLabel'), shortFin, shortFinCorr),
          {
            key: 'totalAssets',
            label: t('reports.reportPreview.totalAssetsLabel'),
            value: String(round1000(assetsTotal)),
            unit: t('reports.reportPreview.thousandRubUnit'),
          },
        ],
      },
      {
        title: t('reports.reportPreview.balancePassivesTitle'),
        fields: [
          row(t('reports.reportPreview.targetFundsLabel'), target, targetCorr),
          {
            key: 'totalPassives',
            label: t('reports.reportPreview.totalPassivesLabel'),
            value: String(round1000(target)),
            unit: t('reports.reportPreview.thousandRubUnit'),
          },
        ],
      },
      {
        title: t('reports.reportPreview.reconciliationTitle'),
        fields: [
          {
            key: 'balanceCheck',
            // ФНС регламент 0710096 допускает расхождение Актив=Пассив до 1 тыс. ₽
            // из-за независимого округления каждой строки. Строгое сравнение
            // `===` показывало ложное «Нет» при валидных отчётах.
            label: t('reports.reportPreview.assetsEqualsPassivesLabel'),
            value: (() => {
              const delta = round1000(assetsTotal) - round1000(target);
              if (Math.abs(delta) <= 1) return t('common.answer.yes');
              return t('reports.reportPreview.assetsNotEqualLabel', { delta });
            })(),
          },
        ],
      },
    ];
  }

  private buildNdfl6(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: t('reports.reportPreview.ndfl6Title'),
        fields: [
          { key: 'period', label: t('reports.reportPreview.periodLabel'), value: this.quarterLabel(ctx.period) },
          { key: 'year', label: t('reports.reportPreview.yearLabel'), value: String(ctx.year) },
          { key: 'kbk', label: t('reports.reportPreview.kbkLabel'), value: '18210102010011000110' },
          { key: 'rate', label: t('reports.reportPreview.taxRateLabel'), value: '13 %' },
          {
            key: 'source',
            label: t('reports.reportPreview.sourceLabel'),
            value: t('reports.reportPreview.materialAidTaxSourceValue'),
          },
        ],
      },
    ];
  }

  private buildRsv(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: t('reports.reportPreview.rsvTitle'),
        fields: [
          { key: 'period', label: t('reports.reportPreview.periodLabel'), value: this.quarterLabel(ctx.period) },
          { key: 'year', label: t('reports.reportPreview.yearLabel'), value: String(ctx.year) },
          { key: 'body', label: t('reports.reportPreview.rsvSectionLabel'), value: t('reports.reportPreview.emptyZeroReportValue') },
        ],
      },
    ];
  }

  private buildDusn(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: t('reports.reportPreview.usnDeclarationTitle'),
        fields: [
          { key: 'period', label: t('reports.reportPreview.periodLabel'), value: t('reports.reportPreview.usnPeriodAnnualValue') },
          // DN1 code review Chunk A: ctx.year = «год за который отчитываемся»,
          // единый контракт со всеми ФНС-генераторами. Раньше было ctx.year-1,
          // что рассинхронизировалось с генератором после унификации.
          { key: 'year', label: t('reports.reportPreview.yearLabel'), value: String(ctx.year) },
          { key: 'obNal', label: t('reports.reportPreview.usnTaxObjectLabel'), value: t('reports.reportPreview.usnTaxObjectIncomeValue') },
          { key: 'rate', label: t('reports.reportPreview.rateLabel'), value: t('reports.reportPreview.usnZeroRateValue') },
          { key: 'sum', label: t('reports.reportPreview.taxAmountLabel'), value: '0' },
        ],
      },
    ];
  }

  private buildFss4(ctx: PreviewContext): PreviewSection[] {
    return [
      {
        title: t('reports.reportPreview.efs1Title'),
        fields: [
          { key: 'period', label: t('reports.reportPreview.sfrPeriodLabel'), value: this.sfrPeriodLabel(ctx.period) },
          { key: 'year', label: t('reports.reportPreview.yearLabel'), value: String(ctx.year) },
          { key: 'chisl', label: t('reports.reportPreview.averageHeadcountLabel'), value: '0' },
          { key: 'tariff', label: t('reports.reportPreview.insuranceTariffLabel'), value: '0.20' },
          { key: 'allSums', label: t('reports.reportPreview.allSumsLabel'), value: t('reports.reportPreview.zeroAmountValue') },
        ],
      },
    ];
  }

  private quarterLabel(q?: number): string {
    const map = { 1: t('reports.reportPreview.quarter1Label'), 2: t('reports.reportPreview.halfYearLabel'), 3: t('reports.reportPreview.nineMonthsLabel'), 4: t('reports.reportPreview.yearPeriodLabel') } as Record<number, string>;
    return q ? map[q] ?? t('reports.reportPreview.quarterNLabel', { number: q }) : t('reports.reportPreview.periodNotSetValue');
  }

  private sfrPeriodLabel(q?: number): string {
    const map = { 1: t('reports.reportPreview.sfrQuarter1Label'), 2: t('reports.reportPreview.sfrHalfYearLabel'), 3: t('reports.reportPreview.sfrNineMonthsLabel'), 4: t('reports.reportPreview.sfrYearLabel') } as Record<number, string>;
    return q ? map[q] ?? String(q) : t('reports.reportPreview.periodNotSetValue');
  }
}
