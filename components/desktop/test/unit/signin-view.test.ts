import { describe, expect, it } from 'vitest';
import { signInViewOf } from 'src/pages/Registrator/SignIn/model/signInView';

/**
 * Страница входа не бывает пустой.
 *
 * Стенд 4, 20.11.2026: вошедший пайщик открыл адрес страницы входа, а она
 * прятала форму из-за завершённой регистрации и никуда не вела — белый экран
 * без ошибок. Форму прячет только принятый советом пайщик, и страница сразу
 * ведёт его на стол.
 */
describe('signInViewOf', () => {
  it('гость → форма входа', () => {
    expect(signInViewOf({ isAuth: false, isFullyActive: false, registratorStep: 1 })).toBe('form');
  });

  it('вошёл, совет не принял (статус не active) → форма, а не пустой экран', () => {
    expect(signInViewOf({ isAuth: true, isFullyActive: false, registratorStep: 1 })).toBe('form');
  });

  it('вошёл и принят советом → переход на стол', () => {
    expect(signInViewOf({ isAuth: true, isFullyActive: true, registratorStep: 1 })).toBe('enter');
  });

  it('принят советом, но регистрация на другом шаге → форма', () => {
    expect(signInViewOf({ isAuth: true, isFullyActive: true, registratorStep: 3 })).toBe('form');
  });

  it('аккаунт активен в памяти, сессии нет → форма', () => {
    expect(signInViewOf({ isAuth: false, isFullyActive: true, registratorStep: 1 })).toBe('form');
  });
});
