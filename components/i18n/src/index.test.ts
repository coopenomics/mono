import { describe, expect, it } from 'vitest';
import {
  coreMessages,
  createTranslator,
  flattenKeys,
  formatDecimalParts,
  formatNumber,
  getMessage,
  hasBranch,
  mergeMessages,
  MessageCollisionError,
  pickLocale,
  pseudoMessage,
  ruPluralIndex,
  ruPluralRule,
} from './index';
import { currentLocale, registerMessages, runWithLocale, t, te } from './server';

const messages = {
  ru: {
    demo: {
      greet: 'Привет, {name}!',
      days: '{n} день | {n} дня | {n} дней',
      daysZero: 'нет дней | {n} день | {n} дня | {n} дней',
      email: "почта{'@'}coop.ru",
      linked: 'Итог: @:demo.greet',
      list: '{0} из {1}',
    },
  },
};

describe('правила множественного числа', () => {
  it.each([
    [1, 0], [2, 1], [4, 1], [5, 2], [11, 2], [12, 2], [14, 2], [21, 0], [22, 1], [25, 2],
    [101, 0], [111, 2], [0, 2], [1.5, 1],
  ])('%d → форма %d', (n, form) => {
    expect(ruPluralIndex(n)).toBe(form);
  });

  it('четыре формы: первая — для нуля', () => {
    expect(ruPluralRule(0, 4)).toBe(0);
    expect(ruPluralRule(1, 4)).toBe(1);
    expect(ruPluralRule(3, 4)).toBe(2);
    expect(ruPluralRule(7, 4)).toBe(3);
  });
});

describe('переводчик', () => {
  const tr = createTranslator({ messages });

  it('подставляет именованные и позиционные параметры', () => {
    expect(tr.t('demo.greet', { name: 'Мир' })).toBe('Привет, Мир!');
    expect(tr.t('demo.list', ['1', '2'])).toBe('1 из 2');
  });

  it('выбирает форму по числу', () => {
    expect(tr.t('demo.days', 1)).toBe('1 день');
    expect(tr.t('demo.days', 3)).toBe('3 дня');
    expect(tr.t('demo.days', 25)).toBe('25 дней');
    expect(tr.t('demo.daysZero', 0)).toBe('нет дней');
    expect(tr.t('demo.days', { n: 2 }, 2)).toBe('2 дня');
  });

  it('литерал @ и ссылки на другие сообщения', () => {
    expect(tr.t('demo.email')).toBe('почта@coop.ru');
    expect(tr.t('demo.linked', { name: 'X' })).toBe('Итог: Привет, X!');
  });

  it('возвращает ключ и сообщает о пропуске', () => {
    const missing: string[] = [];
    const tr2 = createTranslator({ messages, onMissing: (k) => missing.push(k) });
    expect(tr2.t('demo.nope')).toBe('demo.nope');
    expect(missing).toEqual(['demo.nope']);
    expect(tr2.has('demo.greet')).toBe(true);
    expect(tr2.has('demo')).toBe(false);
  });
});

describe('словари', () => {
  it('сливает ветви и запрещает повтор листа', () => {
    const merged = mergeMessages({ a: { b: '1' } }, { a: { c: '2' } });
    expect(flattenKeys(merged)).toEqual(['a.b', 'a.c']);
    expect(() => mergeMessages(merged, { a: { b: '3' } }, 'второй')).toThrow(MessageCollisionError);
  });

  it('ищет сообщение и ветвь по пути', () => {
    expect(getMessage(messages.ru, 'demo.greet')).toBe('Привет, {name}!');
    expect(getMessage(messages.ru, 'demo')).toBeUndefined();
    expect(hasBranch(messages.ru, 'demo')).toBe(true);
    expect(hasBranch(messages.ru, 'demo.greet')).toBe(false);
  });

  it('общие словари содержат обязательные разделы', () => {
    expect(getMessage(coreMessages.ru, 'validation.required')).toBe('Это поле обязательно для заполнения');
    expect(getMessage(coreMessages.ru, 'errors.COMMON_INTERNAL')).toBe('Внутренняя ошибка сервера');
    expect(getMessage(coreMessages.ru, 'common.action.save')).toBe('Сохранить');
  });
});

describe('псевдолокаль', () => {
  it('обрамляет каждую форму и не трогает синтаксис', () => {
    const out = pseudoMessage('{n} день | {n} дня');
    expect(out.split('|')).toHaveLength(2);
    expect(out).toContain('{n}');
    expect(out.startsWith('[!! ')).toBe(true);
    expect(pseudoMessage("a{'@'}b @:demo.greet")).toContain("{'@'}");
    expect(pseudoMessage('see @:demo.greet')).toContain('@:demo.greet');
  });

  it('псевдоперевод компилируется ядром', () => {
    const tr = createTranslator({
      messages: { ru: { x: pseudoMessage('Привет, {name}!'), y: 'Y' } },
    });
    expect(tr.t('x', { name: 'Мир' })).toContain('Мир');
  });
});

describe('Accept-Language', () => {
  it.each([
    ['ru-RU,ru;q=0.9,en;q=0.8', 'ru'],
    ['en-US,en;q=0.9,ru;q=0.5', 'ru'],
    ['en-US', undefined],
    ['', undefined],
    [undefined, undefined],
  ])('%s → %s', (header, locale) => {
    expect(pickLocale(header)).toBe(locale);
  });
});

describe('форматирование', () => {
  it('группирует разряды и ставит запятую', () => {
    expect(formatNumber(1234567).replace(/\s/g, ' ')).toBe('1 234 567');
    expect(formatDecimalParts('1234567', '05').replace(/\s/g, ' ')).toBe('1 234 567,05');
    expect(formatDecimalParts('-12', '50')).toBe('-12,50');
    expect(formatDecimalParts('7', undefined)).toBe('7');
  });
});

describe('серверный контекст', () => {
  it('язык запроса виден в асинхронном коде внутри контекста', async () => {
    const seen = await runWithLocale('ru', async () => {
      await new Promise((r) => setTimeout(r, 1));
      return currentLocale();
    });
    expect(seen).toBe('ru');
    expect(runWithLocale('xx', () => currentLocale())).toBe('ru');
  });

  it('словарь расширения доступен через t()', () => {
    registerMessages('ru', { testExt: { hello: 'Привет, {who}' } }, 'test-ext');
    registerMessages('ru', { testExt: { hello: 'Привет, {who}' } }, 'test-ext');
    expect(t('testExt.hello', { who: 'пайщик' })).toBe('Привет, пайщик');
    expect(te('validation.email')).toBe(true);
    expect(() => registerMessages('ru', { testExt: { hello: 'дубль' } }, 'other')).toThrow(
      MessageCollisionError,
    );
  });
});
