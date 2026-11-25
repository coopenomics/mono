/**
 * Текст для банковского поручения без буквы «ё» (владелец 06.11.2026): банк не
 * принимает «ё» в назначении платежа — «Цифровой Кошелёк», «аванс под отчёт».
 * Реестр: payments.core, случай pay.core.side.23.
 */
import { bankSafeText } from '@coopenomics/extension-kit';

describe('bankSafeText — назначение платежа для банка', () => {
  it('строчная и прописная «ё» заменяются на «е», остальное без изменений', () => {
    expect(bankSafeText('Паевой взнос по соглашению о ЦПП "Цифровой Кошелёк" №6cf52beb. НДС не облагается.')).toBe(
      'Паевой взнос по соглашению о ЦПП "Цифровой Кошелек" №6cf52beb. НДС не облагается.'
    );
    expect(bankSafeText('Аванс под отчёт №abcdef12')).toBe('Аванс под отчет №abcdef12');
    expect(bankSafeText('ЁЛКА ёлка')).toBe('ЕЛКА елка');
  });

  it('текст без «ё», пустая строка и отсутствие назначения проходят как есть', () => {
    expect(bankSafeText('Оплата по договору № 17/2006 от 03.04.1990')).toBe('Оплата по договору № 17/2006 от 03.04.1990');
    expect(bankSafeText('')).toBe('');
    expect(bankSafeText(null)).toBeNull();
    expect(bankSafeText(undefined)).toBeUndefined();
  });
});
