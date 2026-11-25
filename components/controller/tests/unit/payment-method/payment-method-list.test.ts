import { PaymentMethodService } from '~/application/payment-method/services/payment-method.service';
import { PaymentMethodDomainEntity } from '~/domain/payment-method/entities/method-domain.entity';

/**
 * Список способов оплаты отдаётся через DTO (задача 367-3). У реквизитов СБП,
 * сохранённых до появления поля банка, банка нет, а поле `SbpAccount.bank_name`
 * в схеме обязательное: доменная запись без DTO давала пустоту в обязательном
 * поле, и запрос реквизитов на столе падал целиком.
 */
describe('PaymentMethodService.listPaymentMethods — банк у реквизитов СБП', () => {
  const sbp = (data: { phone: string; bank_name?: string }) =>
    new PaymentMethodDomainEntity({ username: 'ant', method_id: '1', method_type: 'sbp', data });

  function serviceWith(items: PaymentMethodDomainEntity[]) {
    const interactor = {
      listPaymentMethods: jest.fn(async () => ({ items, totalCount: items.length, totalPages: 1, currentPage: 1 })),
    };
    return new PaymentMethodService(interactor as never);
  }

  it('реквизиты СБП без банка — пустая строка, а не пустота в обязательном поле', async () => {
    const page = await serviceWith([sbp({ phone: '+79001234567' })]).listPaymentMethods();
    expect(page.items[0].data).toEqual({ phone: '+79001234567', bank_name: '' });
  });

  it('реквизиты СБП с банком — банк как есть', async () => {
    const page = await serviceWith([sbp({ phone: '+79001234567', bank_name: 'Сбербанк' })]).listPaymentMethods();
    expect(page.items[0].data).toEqual({ phone: '+79001234567', bank_name: 'Сбербанк' });
  });

  it('счётчики страницы сохраняются', async () => {
    const page = await serviceWith([sbp({ phone: '+79001234567' }), sbp({ phone: '+79007654321' })]).listPaymentMethods();
    expect(page).toMatchObject({ totalCount: 2, totalPages: 1, currentPage: 1 });
    expect(page.items).toHaveLength(2);
  });
});
