import { describe, expect, it } from 'vitest';
import { authLossAction } from 'src/entities/Session/lib/auth-loss';

/**
 * Что делать, когда сервер перестал признавать токен.
 *
 * Решение владельца 16.10.2026: раз нужен вход или регистрация заново, от прежней
 * сессии не остаётся ничего — частичная очистка оставляла мешанину из двух пайщиков.
 */
describe('authLossAction', () => {
  it('вошедший потерял доступ → сбросить устройство целиком', () => {
    expect(authLossAction(true, false)).toBe('reset');
  });

  it('уже уходим (отказы запросов в полёте) → ничего не делать', () => {
    expect(authLossAction(true, true)).toBe('ignore');
  });

  it('гость → перезагрузка не нужна', () => {
    expect(authLossAction(false, false)).toBe('ignore');
  });
});
