/**
 * Схема настроек DaData принимает то, что присылает форма стола.
 *
 * Форма настроек расширения отправляет незаполненное поле как null — в том числе
 * скрытое `api_url`. Со схемой `optional` установка с ключом падала «api_url:
 * Expected string, received null» (тестнет, 20.10.2026).
 */
import { Schema } from '~/extensions/dadata/dadata-extension.module';

describe('Схема настроек DaData', () => {
  it('установка из формы: ключи заданы, скрытый адрес сервиса пришёл null', () => {
    const parsed = Schema.safeParse({ api_key: 'key', secret_key: 'secret', api_url: null });
    expect(parsed.success).toBe(true);
  });

  it('адрес сервиса можно не передавать вовсе', () => {
    expect(Schema.safeParse({ api_key: 'key', secret_key: '' }).success).toBe(true);
  });

  it('адрес подставного узла (внешний слой тестов) принимается строкой', () => {
    const parsed = Schema.safeParse({ api_key: 'key', secret_key: '', api_url: 'http://stub:8080' });
    expect(parsed.success && parsed.data.api_url).toBe('http://stub:8080');
  });

  it('ключ обязан быть строкой — null ключа не принимается', () => {
    expect(Schema.safeParse({ api_key: null, secret_key: '' }).success).toBe(false);
  });
});
