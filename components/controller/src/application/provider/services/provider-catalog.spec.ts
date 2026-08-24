import axios from 'axios';
import { BadRequestException } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { config } from '~/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Epic 28: каталог витрины подключения — прокси GET /v1/subscription-types
 * провайдера (Bearer, read-only). Реестр: test-registry/billing.subscriptions.yaml.
 */
describe('ProviderService.getConnectionCatalog (Epic 28)', () => {
  const build = () =>
    new ProviderService({} as any, {} as any, { listLatestFor: jest.fn() } as any);

  const withConfig = (base: string, token: string) => {
    (config as any).provider_base_url = base;
    (config as any).provider_bearer_token = token;
  };

  afterEach(() => jest.clearAllMocks());

  it('happy: зовёт /v1/subscription-types с Bearer и coopname, отдаёт types и server_options как есть', async () => {
    withConfig('http://provider:3000', 'tok-123');
    mockedAxios.get.mockResolvedValue({
      data: {
        types: [{ id: 1, code: 'hosting', name: 'Хостинг на сервере', price: 1500 }],
        server_options: [{ instance_type_id: 2, subscription_type_id: 1, name: 'Базовый', price: 1660, trial_days: 30 }],
      },
    });

    const catalog = await build().getConnectionCatalog('partner1');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://provider:3000/v1/subscription-types',
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok-123' },
        params: { coopname: 'partner1' },
      })
    );
    expect(catalog.types[0]).toMatchObject({ code: 'hosting' });
    expect(catalog.server_options[0]).toMatchObject({ price: 1660, trial_days: 30 });
  });

  it('side: без coopname params не передаются; кривой ответ (без массивов) → пустые списки, не падение', async () => {
    withConfig('http://provider:3000', 'tok-123');
    mockedAxios.get.mockResolvedValue({ data: {} });

    const catalog = await build().getConnectionCatalog();

    expect(mockedAxios.get.mock.calls[0][1]).toMatchObject({ params: undefined });
    expect(catalog).toEqual({ types: [], server_options: [] });
  });

  it('break: провайдер не настроен / токен пуст / провайдер недоступен → BadRequest с понятным текстом, наружу не летит стектрейс транспорта', async () => {
    withConfig('', 'tok');
    await expect(build().getConnectionCatalog()).rejects.toBeInstanceOf(BadRequestException);

    withConfig('http://provider:3000', '');
    await expect(build().getConnectionCatalog()).rejects.toThrow('PROVIDER_BEARER_TOKEN');

    withConfig('http://provider:3000', 'tok');
    mockedAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(build().getConnectionCatalog()).rejects.toThrow('временно недоступен');
  });
});
