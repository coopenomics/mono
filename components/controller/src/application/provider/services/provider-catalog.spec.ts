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
    expect(catalog).toEqual({
      types: [],
      server_options: [],
      tariffs: [],
      annual_billing: { enabled: false, discount_percent: 0 },
      current_tariff: null,
      individual_prices: [],
    });
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

/**
 * Тарифная сетка (16.10.2026): каталог несёт тарифы, кооператив-кандидат
 * передаёт выбор провайдеру. Реестр: test-registry/billing.subscriptions.yaml.
 */
describe('ProviderService — тарифная сетка', () => {
  const build = () =>
    new ProviderService({} as any, {} as any, { listLatestFor: jest.fn() } as any);

  beforeEach(() => {
    (config as any).provider_base_url = 'http://provider:3000';
    (config as any).provider_bearer_token = 'tok-123';
    (config as any).server_secret = 'srv-secret';
  });
  afterEach(() => jest.clearAllMocks());

  it('каталог отдаёт тарифы и годовую оплату как их прислал провайдер', async () => {
    const tariff = { code: 'start', name: 'Старт', members_limit: 100, monthly_total: 7500, annual_total: null };
    mockedAxios.get.mockResolvedValue({
      data: { types: [], server_options: [], tariffs: [tariff], annual_billing: { enabled: true, discount_percent: 30 } },
    });

    const catalog = await build().getConnectionCatalog('partner1');

    expect(catalog.tariffs).toEqual([tariff]);
    expect(catalog.annual_billing).toEqual({ enabled: true, discount_percent: 30 });
  });

  it('выбор тарифа уходит PUT /instances/:username/tariff с server-secret и возвращает принятый выбор', async () => {
    mockedAxios.put.mockResolvedValue({ data: { coopname: 'coop1', tariff_code: 'standard', billing_period: 'month' } });

    const res = await build().selectTariff('coop1', 'standard', 'month' as any);

    expect(mockedAxios.put).toHaveBeenCalledWith(
      'http://provider:3000/instances/coop1/tariff',
      { tariff_code: 'standard', billing_period: 'month' },
      expect.objectContaining({ headers: { 'server-secret': 'srv-secret' } })
    );
    expect(res).toEqual({ tariff_code: 'standard', billing_period: 'month' });
  });

  // break: отказ провайдера (тариф вне сетки) не теряется молча
  it('провайдер отклонил выбор → BadRequest с причиной; провайдер не настроен → BadRequest без запроса', async () => {
    mockedAxios.put.mockRejectedValue({ response: { data: { message: "Тариф 'federation' отсутствует в сетке" } } });
    await expect(build().selectTariff('coop1', 'federation', 'month' as any)).rejects.toBeInstanceOf(BadRequestException);

    (config as any).provider_base_url = '';
    mockedAxios.put.mockClear();
    await expect(build().selectTariff('coop1', 'start', 'month' as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(mockedAxios.put).not.toHaveBeenCalled();
  });

  it('каталог отдаёт current_tariff провайдера; без поля — null', async () => {
    mockedAxios.get.mockResolvedValue({ data: { current_tariff: { code: 'start', billing_period: 'year' } } });
    expect((await build().getConnectionCatalog('coop1')).current_tariff).toEqual({ code: 'start', billing_period: 'year' });

    mockedAxios.get.mockResolvedValue({ data: {} });
    expect((await build().getConnectionCatalog('coop1')).current_tariff).toBeNull();
  });

  it('смена тарифа уходит POST /instances/:username/change-tariff с server-secret; отказ провайдера — BadRequest', async () => {
    mockedAxios.post.mockResolvedValue({ data: { migration_state: 'renting', monthly_total: 17300, annual_total: null } });

    const res = await build().changeTariff('coop1', 'standard');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://provider:3000/instances/coop1/change-tariff',
      { tariff_code: 'standard' },
      expect.objectContaining({ headers: { 'server-secret': 'srv-secret' } })
    );
    expect(res).toEqual({ migration_state: 'renting', monthly_total: 17300, annual_total: null });

    mockedAxios.post.mockRejectedValue({ response: { data: { message: 'Переход доступен только на тариф дороже' } } });
    await expect(build().changeTariff('coop1', 'start')).rejects.toBeInstanceOf(BadRequestException);
  });
});

/**
 * Реестр кооперативов показывает тариф заявки (16.10.2026): сетка и выборы —
 * двумя запросами на весь реестр. Реестр: test-registry/billing.subscriptions.yaml.
 */
describe('ProviderService.getCooperativesRegistry — тариф заявки', () => {
  const TARIFF = { code: 'start', name: 'Старт', members_limit: 100, monthly_total: 7500, annual_total: 68400 };
  const build = () => {
    const service = new ProviderService(
      { getAllRows: jest.fn(async () => [
        { username: 'coop1', status: 'pending', announce: 'a.coop.ru', description: '', created_at: '' },
        { username: 'coop2', status: 'pending', announce: 'b.coop.ru', description: '', created_at: '' },
      ]) } as any,
      { findByUsername: jest.fn(async () => null) } as any,
      { listLatestFor: jest.fn(async () => new Map()) } as any,
    );
    jest.spyOn(service, 'getUserSubscriptions').mockResolvedValue([]);
    return service;
  };

  beforeEach(() => {
    (config as any).provider_base_url = 'http://provider:3000';
    (config as any).provider_bearer_token = 'tok-123';
  });
  afterEach(() => jest.clearAllMocks());

  it('тариф и период оплаты подставляются по выбору кооператива; кооператив без выбора — без тарифа', async () => {
    mockedAxios.get.mockImplementation(async (url: string) =>
      url.endsWith('/selections')
        ? { data: [{ coopname: 'coop1', tariff_code: 'start', billing_period: 'year' }] }
        : { data: { tariffs: [TARIFF] } }
    );

    const [coop1, coop2] = await build().getCooperativesRegistry();

    expect(coop1.tariff).toMatchObject({ code: 'start', name: 'Старт' });
    expect(coop1.tariff_billing_period).toBe('year');
    expect(coop2.tariff).toBeUndefined();
  });

  // break: тарифы — подсказка совету; сбой провайдера реестр не роняет
  it('провайдер не отдал выборы → реестр без тарифов, но целиком', async () => {
    mockedAxios.get.mockRejectedValue(new Error('down'));

    const rows = await build().getCooperativesRegistry();

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.tariff === undefined)).toBe(true);
  });
});

/**
 * Индивидуальные цены кооперативов у оператора (решение владельца 28.10.2026).
 * Реестр: test-registry/billing.subscriptions.yaml.
 */
describe('ProviderService — индивидуальные цены кооператива', () => {
  const build = () => new ProviderService({} as any, {} as any, { listLatestFor: jest.fn() } as any);

  beforeEach(() => {
    (config as any).provider_base_url = 'http://provider:3000';
    (config as any).provider_bearer_token = 'tok-123';
    (config as any).server_secret = 'secret-1';
  });
  afterEach(() => jest.clearAllMocks());

  it('happy: каталог отдаёт individual_prices как есть; провайдер без них — пустой список', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { types: [], individual_prices: [{ subscription_type_id: 3, code: 'docflow', amount_per_month: 900 }] },
    });
    expect((await build().getConnectionCatalog('partner1')).individual_prices).toEqual([
      { subscription_type_id: 3, code: 'docflow', amount_per_month: 900 },
    ]);

    mockedAxios.get.mockResolvedValueOnce({ data: { types: [] } });
    expect((await build().getConnectionCatalog('partner1')).individual_prices).toEqual([]);
  });

  it('happy: назначение идёт PUT /coop-prices/:coopname/:typeId с server-secret, ответ провайдера возвращается', async () => {
    const row = { subscription_type_id: 3, code: 'docflow', name: 'ЭДО', amount_per_month: 0, list_price_per_month: 1500, reason: 'пилот', created_by: 'service', updated_at: '2026-10-28T10:00:00.000Z' };
    mockedAxios.put.mockResolvedValueOnce({ data: row });

    const res = await build().setCoopPrice('partner1', 3, 0, 'пилот');

    expect(mockedAxios.put).toHaveBeenCalledWith(
      'http://provider:3000/coop-prices/partner1/3',
      { amount_per_month: 0, reason: 'пилот' },
      expect.objectContaining({ headers: { 'server-secret': 'secret-1' } }),
    );
    expect(res).toEqual(row);
  });

  it('happy: снятие идёт DELETE; список — GET тем же каналом', async () => {
    mockedAxios.delete.mockResolvedValueOnce({ data: '' });
    mockedAxios.get.mockResolvedValueOnce({ data: [{ subscription_type_id: 3 }] });

    await build().removeCoopPrice('partner1', 3);
    const list = await build().listCoopPrices('partner1');

    expect(mockedAxios.delete).toHaveBeenCalledWith(
      'http://provider:3000/coop-prices/partner1/3',
      expect.objectContaining({ headers: { 'server-secret': 'secret-1' } }),
    );
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://provider:3000/coop-prices/partner1',
      expect.objectContaining({ headers: { 'server-secret': 'secret-1' } }),
    );
    expect(list).toEqual([{ subscription_type_id: 3 }]);
  });

  it('break: отказ провайдера (услуга не найдена) — понятная ошибка с причиной, не сырой axios', async () => {
    mockedAxios.put.mockRejectedValueOnce({ response: { data: { message: 'Услуга #777 не найдена' } } });

    await expect(build().setCoopPrice('partner1', 777, 10, null)).rejects.toMatchObject({
      message: expect.stringContaining('Услуга #777 не найдена'),
    });
  });

  it('break: провайдер не настроен — отказ до запроса', async () => {
    (config as any).provider_base_url = '';
    await expect(build().listCoopPrices('partner1')).rejects.toBeInstanceOf(BadRequestException);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
