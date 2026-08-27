import { humanizeBillingError } from './billing-error.utils';

/**
 * История списаний в кабинете пайщика: отказ узла приходит отладочным следом
 * контракта, и показывать его как есть — значит не объяснить ничего.
 */
describe('humanizeBillingError', () => {
  it('happy: отказ по деньгам → одна понятная фраза вместо assertion failure', () => {
    expect(
      humanizeBillingError(
        'assertion failure with message: walletop TRANSFER: недостаточно средств на кошельке w.wal.bill',
      ),
    ).toBe('Недостаточно средств на кошельке кооператива');

    // BURN формулирует то же самое иначе — обе формы ведут к одной причине.
    expect(
      humanizeBillingError(
        'assertion failure with message: walletop BURN: недостаточно available на кошельке w.wal.bill',
      ),
    ).toBe('Недостаточно средств на кошельке кооператива');
  });

  it('happy: нет программных соглашений → говорим про соглашение, а не про program_id', () => {
    expect(
      humanizeBillingError(
        'assertion failure with message: walletop: у пайщика voskhod нет программных соглашений в wallet::users (требуется program_id=1 для w.wal.bill)',
      ),
    ).toBe('Кооператив не подписал соглашение о списании взносов');
  });

  it('happy: сетевые сбои читаются как недоступность сервиса, а не как отказ в оплате', () => {
    expect(humanizeBillingError('connect ECONNREFUSED 172.27.0.10:3000')).toBe(
      'Сервис оплаты временно недоступен',
    );
  });

  it('happy: отказ ноды по ресурсам/сроку читается как «повторим», а не как отказ в оплате', () => {
    expect(
      humanizeBillingError(
        'transaction 81cf2406 was executing for too long 304824us reached on chain max_transaction_cpu_usage 290000us',
      ),
    ).toBe('Сеть не успела провести списание — повторим на следующем круге');

    expect(humanizeBillingError('expired transaction: transaction expired')).toBe(
      'Списание не успело попасть в блок — повторим на следующем круге',
    );
  });

  it('side: незнакомый отказ контракта → показываем суть без служебной обёртки', () => {
    expect(humanizeBillingError('assertion failure with message: billing: unknown guard')).toBe(
      'Блокчейн отклонил списание: billing: unknown guard',
    );
  });

  it('side: обычный текст без обёртки возвращается как есть — терять сообщение нельзя', () => {
    expect(humanizeBillingError('Request failed with status code 400')).toBe(
      'Request failed with status code 400',
    );
  });

  it('break: пусто/пробелы/null → причины нет, интерфейс не рисует пустую строку', () => {
    expect(humanizeBillingError(null)).toBeUndefined();
    expect(humanizeBillingError(undefined)).toBeUndefined();
    expect(humanizeBillingError('')).toBeUndefined();
    expect(humanizeBillingError('   ')).toBeUndefined();
  });
});
