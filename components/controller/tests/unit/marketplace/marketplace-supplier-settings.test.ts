/**
 * Реквизиты для выплат поставщику на странице «Выплаты» (реестр
 * marketplace.payouts, mkt.payouts.side.15).
 *
 * Поле «Реквизиты для выплат» не пустует, пока реквизиты есть: узел отдаёт
 * идентификатор реквизитов, на которые поступит следующая выплата, — явный
 * выбор поставщика либо реквизиты по умолчанию (замечание владельца
 * 20.11.2026: «когда дефолтная — чтобы она там установлена была»).
 */
import { MarketplaceSupplierSettingsService } from '~/extensions/marketplace/application/services/marketplace-supplier-settings.service';

const COOP = 'voskhod';
const SUPPLIER = 'sidorov';

const sbp = (method_id: string, is_default: boolean) => ({
  method_id,
  method_type: 'sbp',
  is_default,
  data: { phone: '+7 (123) 123-33-21', bank_name: 'ПАО СБЕРБАНК' },
});

function build(opts: { selected?: string | null; methods: ReturnType<typeof sbp>[] }) {
  const settingsRepo = {
    getPayoutMethodId: jest.fn(async () => opts.selected ?? null),
    setPayoutMethodId: jest.fn(async () => undefined),
  };
  const paymentMethodRepo = {
    get: jest.fn(async ({ method_id }: { method_id: string }) => {
      const found = opts.methods.find((m) => m.method_id === method_id);
      if (!found) throw new Error('нет такого метода');
      return found;
    }),
    list: jest.fn(async () => ({ items: opts.methods })),
  };
  return new MarketplaceSupplierSettingsService(settingsRepo as never, paymentMethodRepo as never);
}

describe('настройки выплат поставщика: действующие реквизиты', () => {
  it('выбора нет — поле показывает реквизиты по умолчанию', async () => {
    const service = build({ methods: [sbp('m1', false), sbp('m2', true)] });
    const view = await service.getSettings(COOP, SUPPLIER);
    expect(view).toMatchObject({ payout_method_id: null, resolved_method_id: 'm2', has_payout_method: true });
  });

  it('явный выбор поставщика — поле показывает выбранные реквизиты', async () => {
    const service = build({ selected: 'm1', methods: [sbp('m1', false), sbp('m2', true)] });
    const view = await service.getSettings(COOP, SUPPLIER);
    expect(view).toMatchObject({ payout_method_id: 'm1', resolved_method_id: 'm1' });
  });

  it('выбранные реквизиты удалены — поле показывает реквизиты по умолчанию', async () => {
    const service = build({ selected: 'gone', methods: [sbp('m2', true)] });
    const view = await service.getSettings(COOP, SUPPLIER);
    expect(view).toMatchObject({ payout_method_id: 'gone', resolved_method_id: 'm2' });
  });

  it('единственные реквизиты без отметки «по умолчанию» — выплата поступит на них', async () => {
    const service = build({ methods: [sbp('m1', false)] });
    expect((await service.getSettings(COOP, SUPPLIER)).resolved_method_id).toBe('m1');
  });

  it('реквизитов нет — поле пустое, выплатить некуда', async () => {
    const service = build({ methods: [] });
    const view = await service.getSettings(COOP, SUPPLIER);
    expect(view).toMatchObject({ resolved_method_id: null, has_payout_method: false, payout_destination: null });
  });
});
