/**
 * Реестр поставщиков сведений об организации по ИНН.
 *
 * Что здесь защищается. Анкета организации заполняется из реестра страны,
 * только если для страны встал коннектор. Сбой или молчание сервиса анкету не
 * останавливают — ответ пустой, и пайщик заполняет поля сам. Остановленное
 * расширение снимается, и анкета возвращается к ручному вводу.
 *
 * Реестр случаев: test-registry/registration.organization-lookup.yaml
 */

import type {
  IOrganizationLookupHook,
  InnerEntrepreneurLookupRecord,
  InnerOrganizationLookupRecord,
} from '@coopenomics/innercoop';
import {
  ORGANIZATION_LOOKUP_TIMEOUT_MS,
  OrganizationLookupRegistry,
} from '~/application/organization-lookup/organization-lookup.registry';

const RECORD: InnerOrganizationLookupRecord = { short_name: 'ПК "РОМАШКА"', details: { inn: '7700000000' } };
const IP_RECORD: InnerEntrepreneurLookupRecord = { last_name: 'Петров', details: { inn: '770000000001' } };

function provider(
  country: string,
  findByInn: IOrganizationLookupHook['findByInn'],
  extensionName = 'dadata'
): IOrganizationLookupHook & { findByInn: jest.Mock } {
  return { extensionName, country, findByInn: jest.fn(findByInn) };
}

describe('OrganizationLookupRegistry', () => {
  afterEach(() => jest.useRealTimers());

  it('отдаёт сведения поставщика страны анкеты', async () => {
    const registry = new OrganizationLookupRegistry();
    const russia = provider('Russia', async () => RECORD);
    registry.register(russia);

    await expect(registry.findByInn('Russia', '7700000000')).resolves.toEqual(RECORD);
    expect(russia.findByInn).toHaveBeenCalledWith('7700000000');
    expect(registry.countries()).toEqual(['Russia']);
  });

  it('без поставщика страны ответ пустой — анкета заполняется вручную', async () => {
    const registry = new OrganizationLookupRegistry();
    registry.register(provider('Russia', async () => RECORD));

    await expect(registry.findByInn('Kazakhstan', '123456789012')).resolves.toBeNull();
  });

  it('упавший сервис не роняет анкету: ответ пустой', async () => {
    const registry = new OrganizationLookupRegistry();
    registry.register(
      provider('Russia', async () => {
        throw new Error('DaData ответила 403');
      })
    );

    await expect(registry.findByInn('Russia', '7700000000')).resolves.toBeNull();
  });

  it('молчащий сервис не держит анкету дольше предела', async () => {
    jest.useFakeTimers();
    const registry = new OrganizationLookupRegistry();
    registry.register(provider('Russia', () => new Promise(() => undefined)));

    const pending = registry.findByInn('Russia', '7700000000');
    jest.advanceTimersByTime(ORGANIZATION_LOOKUP_TIMEOUT_MS);

    await expect(pending).resolves.toBeNull();
  });

  it('новый поставщик страны заменяет прежнего', async () => {
    const registry = new OrganizationLookupRegistry();
    const first = provider('Russia', async () => null, 'first');
    const second = provider('Russia', async () => RECORD, 'second');
    registry.register(first);
    registry.register(second);

    await expect(registry.findByInn('Russia', '7700000000')).resolves.toEqual(RECORD);
    expect(first.findByInn).not.toHaveBeenCalled();
  });

  it('сведения ИП отдаёт поставщик страны анкеты', async () => {
    const registry = new OrganizationLookupRegistry();
    const russia = provider('Russia', async () => RECORD);
    russia.findEntrepreneurByInn = jest.fn(async () => IP_RECORD);
    registry.register(russia);

    await expect(registry.findEntrepreneurByInn('Russia', '770000000001')).resolves.toEqual(IP_RECORD);
    expect(russia.findEntrepreneurByInn).toHaveBeenCalledWith('770000000001');
    expect(russia.findByInn).not.toHaveBeenCalled();
  });

  it('поставщик без реестра ИП отвечает пусто — анкета ИП заполняется вручную', async () => {
    const registry = new OrganizationLookupRegistry();
    registry.register(provider('Russia', async () => RECORD));

    await expect(registry.findEntrepreneurByInn('Russia', '770000000001')).resolves.toBeNull();
  });

  it('упавший поиск ИП не роняет анкету: ответ пустой', async () => {
    const registry = new OrganizationLookupRegistry();
    const russia = provider('Russia', async () => RECORD);
    russia.findEntrepreneurByInn = jest.fn(async () => {
      throw new Error('DaData ответила 500');
    });
    registry.register(russia);

    await expect(registry.findEntrepreneurByInn('Russia', '770000000001')).resolves.toBeNull();
  });

  it('остановка расширения снимает его поставщика и только его', () => {
    const registry = new OrganizationLookupRegistry();
    registry.register(provider('Russia', async () => RECORD, 'dadata'));
    registry.register(provider('Kazakhstan', async () => RECORD, 'kz-registry'));

    registry.onExtensionTerminate({ appName: 'dadata' });

    expect(registry.countries()).toEqual(['Kazakhstan']);
  });
});
