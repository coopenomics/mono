/**
 * Содержание процесса на столе бухгалтера (слово владельца 17.11.2026): по
 * процессу видно имущество, стороны, суммы и состояние, а не только учёт.
 * Каждое приложение описывает свои процессы в реестре processContent; процесс
 * без описания либо со стёртой записью получает общее содержание из сводки.
 */
import {
  contentAsset,
  contentDay,
  contentFact,
  contentMoney,
  processContentRegistry,
  type ProcessContentDTO,
} from '@coopenomics/extension-kit';
import { MarketplaceProcessContentService } from '~/extensions/marketplace/application/services/marketplace-process-content.service';

const HASH = 'ab'.repeat(32);

function card(title: string): ProcessContentDTO {
  return { title, subtitle: null, image_url: null, amount: null, amount_label: null, status: null, facts: [], links: [] };
}

describe('реестр содержания процесса', () => {
  it('отдаёт описание приложения процесса', async () => {
    processContentRegistry.register('p.test.own', { content: async () => card('Описание приложения') });
    processContentRegistry.registerFallback({ content: async () => card('Общее') });
    expect((await processContentRegistry.describe(HASH, 'voskhod', 'p.test.own'))?.title).toBe('Описание приложения');
  });

  it('без описания приложения отдаёт общее содержание из сводки', async () => {
    processContentRegistry.registerFallback({ content: async () => card('Общее') });
    expect((await processContentRegistry.describe(HASH, 'voskhod', 'p.test.none'))?.title).toBe('Общее');
  });

  it('запись сущности стёрта — общее содержание вместо пустой карточки', async () => {
    processContentRegistry.register('p.test.erased', { content: async () => null });
    processContentRegistry.registerFallback({ content: async () => card('Общее') });
    expect((await processContentRegistry.describe(HASH, 'voskhod', 'p.test.erased'))?.title).toBe('Общее');
  });
});

describe('помощники карточки содержания', () => {
  it('пустое значение строки сведений не показывается', () => {
    expect(contentFact('Причина', '')).toEqual([]);
    expect(contentFact('Причина', null)).toEqual([]);
    expect(contentFact('Позиций', 0)).toEqual([{ label: 'Позиций', value: '0' }]);
  });

  it('сумма словами принимает актив цепи и число строкой', () => {
    expect(contentMoney('100.0000 RUB')).toBe('100,00 RUB');
    expect(contentMoney('2348.39', 'RUB').replace(/\s/g, ' ')).toBe('2 348,39 RUB');
  });

  it('главная сумма — актив с точностью и символом', () => {
    expect(contentAsset('10000.0000', 'RUB', 4)).toBe('10000.0000 RUB');
    expect(contentAsset('1000.0000 RUB', 'RUB', 4)).toBe('1000.0000 RUB');
    expect(contentAsset(null, 'RUB', 4)).toBeNull();
  });

  it('дата — по Москве, секунды цепи и дата базы', () => {
    expect(contentDay('2026-11-17T21:30:00Z')).toBe('18.11.2026');
    expect(contentDay(null)).toBe('');
    expect(contentDay('не дата')).toBe('');
  });
});

describe('содержание поставки Стола заказов', () => {
  function make() {
    const order = {
      id: 'O1', order_hash: HASH, coopname: 'voskhod', quantity: 100, unit_of_measure: 'L', package_size: 1,
      total_cost: '10000.0000', price_per_unit: '100.0000', status: 'RECEIVED', supplier_account: 'petrov',
      orderer_account: 'ivanov', delivery_braname: 'pobswpilmjob', blocked_at: null, accepted_at: null,
      received_at: null, warranty_until: null,
    };
    const orderRepo = { findByOrderHash: jest.fn(async () => order), findById: jest.fn(async () => order) } as any;
    const display = {
      enrichOne: jest.fn(async () => ({
        product_name: 'Молоко', image_url: '/img.jpg', delivery_point_name: 'РОМАШКА',
        supplier_name: 'Петров Пётр Петрович', orderer_name: 'Иванов Иван Иванович',
      })),
    } as any;
    const service = new MarketplaceProcessContentService(
      orderRepo, {} as any, {} as any, {} as any, {} as any, { getDisplayName: jest.fn() } as any, {} as any,
      display, { symbol: 'RUB', decimals: 4 } as any,
    );
    return { service, orderRepo };
  }

  it('называет имущество, количество, стоимость, стороны по ФИО и участок по названию', async () => {
    const { service, orderRepo } = make();
    const content = await service.content(HASH.toUpperCase(), 'voskhod', 'p.mkt.supply');
    expect(orderRepo.findByOrderHash).toHaveBeenCalledWith('voskhod', HASH);
    expect(content?.title).toBe('Молоко');
    expect(content?.amount).toBe('10000.0000 RUB');
    const facts = Object.fromEntries((content?.facts ?? []).map((f) => [f.label, f.value]));
    expect(facts['Поставщик']).toBe('Петров Пётр Петрович');
    expect(facts['Заказчик']).toBe('Иванов Иван Иванович');
    expect(facts['Участок']).toBe('«РОМАШКА» (pobswpilmjob)');
    expect(content?.links[0]?.path).toBe('/market-admin/orders/O1');
  });

  it('заказа нет на узле — содержания нет, стол берёт общее', async () => {
    const { service, orderRepo } = make();
    orderRepo.findByOrderHash.mockResolvedValueOnce(null);
    expect(await service.content(HASH, 'voskhod', 'p.mkt.supply')).toBeNull();
  });

  it('чужой тип процесса поставщик не описывает', async () => {
    const { service } = make();
    expect(await service.content(HASH, 'voskhod', 'p.wal.depo')).toBeNull();
  });
});
