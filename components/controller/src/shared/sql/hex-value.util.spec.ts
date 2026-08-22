import { isHexHash } from './hex-value.util';

/**
 * От этой функции зависит, найдётся ли документ и появится ли вопрос в повестке:
 * она решает, сравнивать значение с учётом регистра или без. Ошибка в обе
 * стороны тихая — либо пустой результат, либо лишнее совпадение.
 */
describe('isHexHash', () => {
  it('признаёт хэш из цепи в любом регистре', () => {
    const lower = '2f158d869466cd9dbf127607a8a284eb8624cda2e91465d6bf08ac5089488003';
    expect(isHexHash(lower)).toBe(true);
    expect(isHexHash(lower.toUpperCase())).toBe(true);
    expect(isHexHash('11d9594fba2589bd18d8a8f5c0dc6a2c')).toBe(true);
  });

  it('не считает хэшем имя аккаунта, число и текст', () => {
    expect(isHexHash('voskhod')).toBe(false);
    expect(isHexHash('4')).toBe(false);
    expect(isHexHash('freedecision')).toBe(false);
    // Слишком короткая шестнадцатеричная строка — обычное значение, не хэш.
    expect(isHexHash('deadbeef')).toBe(false);
  });

  it('не считает хэшем строку с посторонними символами', () => {
    expect(isHexHash("2f158d86'; DROP TABLE blockchain_actions; --")).toBe(false);
    expect(isHexHash('2f158d869466cd9dbf127607a8a284eb8624cda2e91465d6bf08ac508948800з')).toBe(false);
  });
});
