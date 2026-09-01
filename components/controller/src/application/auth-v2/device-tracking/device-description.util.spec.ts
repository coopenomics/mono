import { describeUserAgent, isPrivateIp, resolveIpLocation } from './device-description.util';

describe('describeUserAgent — человекочитаемое устройство из UA', () => {
  it('десктопные браузеры', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome на macOS');
    expect(
      describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'),
    ).toBe('Firefox на Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      ),
    ).toBe('Safari на macOS');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
      ),
    ).toBe('Edge на Windows');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 YaBrowser/24.1.0.0 Safari/537.36',
      ),
    ).toBe('Яндекс Браузер на Windows');
  });

  it('мобильные платформы', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Chrome на iPhone');
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome на Android');
  });

  it('пусто/мусор → «неизвестное устройство»', () => {
    expect(describeUserAgent(null)).toBe('неизвестное устройство');
    expect(describeUserAgent('curl/8.4.0')).toBe('неизвестное устройство');
  });
});

describe('isPrivateIp — приватные и служебные адреса', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.18.0.12', '169.254.1.1', '::1', '::ffff:172.18.0.1', 'fd00::1', 'fe80::1'])(
    '%s — приватный',
    (ip) => expect(isPrivateIp(ip)).toBe(true),
  );
  it.each(['8.8.8.8', '95.24.10.1', '172.32.0.1', '2a00:1450::1'])('%s — публичный', (ip) =>
    expect(isPrivateIp(ip)).toBe(false),
  );
});

describe('resolveIpLocation — best-effort гео', () => {
  it('приватный IP → «локальная сеть» без обращения к внешнему сервису', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('сеть в тестах запрещена'));
    await expect(resolveIpLocation('::ffff:172.18.0.12')).resolves.toBe('локальная сеть');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('сбой внешнего сервиса → null (уведомление уходит без геометки)', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    await expect(resolveIpLocation('8.8.8.8')).resolves.toBeNull();
    fetchSpy.mockRestore();
  });

  it('успешный ответ → «Город, Страна»', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, city: 'Москва', country: 'Россия' }),
    } as unknown as Response);
    await expect(resolveIpLocation('8.8.8.8')).resolves.toBe('Москва, Россия');
    fetchSpy.mockRestore();
  });
});
