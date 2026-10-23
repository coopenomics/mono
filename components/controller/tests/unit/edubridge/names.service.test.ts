/** ФИО пайщика для столов: сертификат ядра → «Фамилия Имя Отчество» или наименование организации; поиск по ФИО и учётному имени. */
import { EdubridgeNamesService } from '~/extensions/edubridge/application/membership/edubridge-names.service';

function make(certs: Record<string, any>) {
  const port = { getCertificateByUsername: jest.fn(async (u: string) => certs[u] ?? null) } as any;
  return { service: new EdubridgeNamesService(port), port };
}

describe('EdubridgeNamesService', () => {
  it('физлицо — ФИО, организация — короткое наименование, без сертификата — пусто', async () => {
    const { service } = make({
      ant: { username: 'ant', last_name: 'Муравьёв', first_name: 'Алексей', middle_name: ' ' },
      org: { username: 'org', short_name: 'ООО «Восход»' },
    });
    await expect(service.displayName('ant')).resolves.toBe('Муравьёв Алексей');
    await expect(service.displayName('org')).resolves.toBe('ООО «Восход»');
    await expect(service.displayName('ghost')).resolves.toBe('');
  });

  it('пачка: один запрос на уникальное имя, ошибка порта не роняет — пустое имя', async () => {
    const { service, port } = make({ ant: { username: 'ant', last_name: 'Муравьёв', first_name: 'Алексей' } });
    port.getCertificateByUsername.mockImplementationOnce(async () => { throw new Error('core down'); });
    const names = await service.displayNames(['ant', 'ant', 'bob']);
    expect(port.getCertificateByUsername).toHaveBeenCalledTimes(2);
    expect(names.get('bob')).toBe('');
  });

  it('поиск: по фрагменту ФИО или учётного имени без учёта регистра; пустой запрос — всё', () => {
    expect(EdubridgeNamesService.matches('мурав', 'ant', 'Муравьёв Алексей')).toBe(true);
    expect(EdubridgeNamesService.matches('ANT', 'ant', '')).toBe(true);
    expect(EdubridgeNamesService.matches('иванов', 'ant', 'Муравьёв Алексей')).toBe(false);
    expect(EdubridgeNamesService.matches('  ', 'ant', '')).toBe(true);
  });
});
