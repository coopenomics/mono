/**
 * Банковские реквизиты пайщика приходят без разметки — и при добавлении
 * способа оплаты, и при правке счёта.
 *
 * Реквизиты вложены во вход мутации, а проверка вложенного объекта работает,
 * только если он превращён в свой класс: без @Type(() => BankAccountInputDTO)
 * рядом с @ValidateNested правила полей (@NoMarkup) не запускались вовсе, и
 * «Банк <script>» сохранялся как есть (нашёл внешний слой, 24.09.2026).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddPaymentMethodInputDTO } from '~/application/payment-method/dto/add-payment-method-input.dto';
import { UpdateBankAccountInputDTO } from '~/application/payment-method/dto/update-bank-account-input.dto';
import { CreateBankAccountInputDTO } from '~/application/payment-method/dto/create-bank-account-input.dto';

const bank = (bank_name: string) => ({
  account_number: '40817810000000000001',
  bank_name,
  currency: 'RUB',
  card_number: '',
  details: { bik: '044525225', corr: '30101810400000000225', kpp: '' },
});

async function errorsOf(cls: any, plain: object): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, plain) as object);
  const flat: string[] = [];
  const walk = (list: any[], prefix: string) => {
    for (const e of list) {
      flat.push(`${prefix}${e.property}`);
      if (e.children?.length) walk(e.children, `${prefix}${e.property}.`);
    }
  };
  walk(errors, '');
  return flat;
}

describe('банковские реквизиты без разметки', () => {
  it('добавление способа оплаты с разметкой в названии банка — отказ', async () => {
    const errors = await errorsOf(AddPaymentMethodInputDTO, {
      username: 'ivanov',
      is_default: false,
      bank_transfer_data: bank('Банк <script>x</script>'),
    });
    expect(errors).toContain('bank_transfer_data.bank_name');
  });

  it('правка и создание счёта с разметкой — отказ', async () => {
    const update = await errorsOf(UpdateBankAccountInputDTO, {
      username: 'ivanov',
      method_id: 'a1b2',
      is_default: false,
      data: bank('Банк <img src=x onerror=alert(1)>'),
    });
    expect(update).toContain('data.bank_name');

    const create = await errorsOf(CreateBankAccountInputDTO, {
      username: 'ivanov',
      is_default: false,
      data: bank('<b>Банк</b>'),
    });
    expect(create).toContain('data.bank_name');
  });

  it('обычные реквизиты проходят', async () => {
    const errors = await errorsOf(AddPaymentMethodInputDTO, {
      username: 'ivanov',
      is_default: false,
      bank_transfer_data: bank('ПАО «Сбербанк» — отделение № 1'),
    });
    expect(errors.filter(e => e.startsWith('bank_transfer_data'))).toEqual([]);
  });
});
