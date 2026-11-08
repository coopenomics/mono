import { describe, expect, it } from 'vitest';
import { Zeus } from '@coopenomics/sdk';

/**
 * Число дел на пункте меню «Инициаторы участка» (слово владельца 08.11.2026:
 * по меню не догадаться, что есть что подписать). Те же условия решают, какие
 * кнопки стоят в строке заявления на странице.
 */
const { propertyActionsCount, canApproveProperty, canSignPropertyAct, canAcceptProperty } = await import(
  'src/entities/MarketplaceInvestment/lib/propertyActions'
);

const S = Zeus.MarketplaceInvestPropertyStatus;
const prop = (username: string, status: Zeus.MarketplaceInvestPropertyStatus) => ({ username, status }) as never;

describe('mkt.order.invest.ui.badge — дела по заявлениям на имущество', () => {
  const rows = [prop('anna', S.CREATED), prop('anna', S.AUTHORIZED), prop('boris', S.ACT1), prop('boris', S.APPROVED)];

  it('председатель участка: одобрить поданное; акт и вопрос в совете — не его дело', () => {
    expect(propertyActionsCount(rows, { username: 'chair', isTrustee: true, isChairman: false })).toBe(1);
    expect(canApproveProperty(rows[0], true)).toBe(true);
    expect(canAcceptProperty(rows[2], false)).toBe(false);
    expect(canApproveProperty(rows[3], true)).toBe(false);
  });

  it('председатель совета: подписать акт второй подписью — одобрение в совете (решение владельца 08.11.2026)', () => {
    expect(propertyActionsCount(rows, { username: 'ant', isTrustee: false, isChairman: true })).toBe(1);
    expect(canAcceptProperty(rows[2], true)).toBe(true);
  });

  it('вносящий: подписать свой акт после решения совета; чужие заявления не считаются', () => {
    expect(propertyActionsCount(rows, { username: 'anna', isTrustee: false, isChairman: false })).toBe(1);
    expect(canSignPropertyAct(rows[1], 'anna')).toBe(true);
    expect(canSignPropertyAct(rows[1], 'boris')).toBe(false);
    expect(propertyActionsCount(rows, { username: 'boris', isTrustee: false, isChairman: false })).toBe(0);
  });

  it('без заявлений — ноль, бейджа нет', () => {
    expect(propertyActionsCount([], { username: 'anna', isTrustee: true, isChairman: true })).toBe(0);
  });
});
