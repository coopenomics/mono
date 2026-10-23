/**
 * Форматирование сумм каркаса расширений. После переноса из контроллера в
 * extension-kit функция ссылалась на `config` ядра, которого в пакете нет, —
 * любая сверка суммы подписанного заявления (взнос в программу Благороста и
 * т. п.) падала «config is not defined». Точность и символ — из настроек платформы.
 */
import { CurrencyValidationUtil, platformSettings } from '@coopenomics/extension-kit';

describe('CurrencyValidationUtil.formatAmount', () => {
  it('по умолчанию берёт точность и символ токена из настроек платформы', () => {
    const { rootGovernPrecision, rootGovernSymbol } = platformSettings().blockchain;
    expect(CurrencyValidationUtil.formatAmount(1000)).toBe(`${(1000).toFixed(rootGovernPrecision)} ${rootGovernSymbol}`);
  });

  it('явная точность важнее настроек', () => {
    const { rootGovernSymbol } = platformSettings().blockchain;
    expect(CurrencyValidationUtil.formatAmount(12.5, 2)).toBe(`12.50 ${rootGovernSymbol}`);
  });

  it('суммы из заявления и из запроса сравниваются одинаково, как в сверке подписанного документа', () => {
    const expected = CurrencyValidationUtil.extractAmountValue('1000.0000 RUB');
    const actual = CurrencyValidationUtil.extractAmountValue('1000 RUB');
    expect(CurrencyValidationUtil.formatAmount(expected)).toBe(CurrencyValidationUtil.formatAmount(actual));
  });
});
