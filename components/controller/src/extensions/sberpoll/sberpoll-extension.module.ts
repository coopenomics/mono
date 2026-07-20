import { PollingProvider } from '~/application/gateway/providers/polling-provider';
import type { PaymentDetailsDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import { REDIS_PORT, RedisPort } from '~/domain/common/ports/redis.port';
import { PAYMENT_STATE_REPOSITORY, PaymentStateRepository } from '~/domain/gateway/repositories/payment-state.repository';
import axios from 'axios';
import { checkPaymentAmount, checkPaymentSymbol, getAmountPlusFee } from '~/shared/utils/payments';
import config from '../../config/config';
import { Inject, Module } from '@nestjs/common';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { TypeOrmExtensionDomainRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-extension.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { z } from 'zod';
import type { Cooperative } from 'cooptypes';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { TypeOrmPaymentRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-payment.repository';
import { PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';

// Дефолтные параметры конфигурации
export const defaultConfig = {};

interface Link {
  href: string;
  rel: string;
}

interface StatementTransactionV2 {
  id: string;
  transactionDate: string;
  paymentPurpose: string;
  amountRub: {
    amount: string;
    currencyName: string;
  };
  direction: 'DEBIT' | 'CREDIT';
  documentDate: string; //дата 2023-11-14;
  rurTransfer: {
    payerAccount: string; //'40802810706000000087';
    payerName: string; //'ИП_Автотест_Клиент_ЕКС_20231027092336';
    payerInn: string; //'213504669246';
    payerKpp: string; //'346801713';
    payerBankName: string; //'БАШКИРСКОЕ ОТДЕЛЕНИЕ N8598 ПАО СБЕРБАНК, г. Уфа';
    payerBankBic: string; //'048073601';
    payerBankCorrAccount: string; //'30101810300000000601';
    payeeAccount: string; //'40702810006000001792';
    payeeName: string; //'ТЕСТ9036';
    payeeInn: string; //'7379190522';
    payeeKpp: string; //'683801910';
    payeeBankName: string; //'БАШКИРСКОЕ ОТДЕЛЕНИЕ N8598 ПАО СБЕРБАНК, г. Уфа';
    payeeBankBic: string; //'048073601';
    payeeBankCorrAccount: string; //'30101810300000000601';
    receiptDate: string; //'2023-11-14';
    valueDate: string; //'2023-11-14';
  };
  // Добавьте другие необходимые поля
  // https://developers.sber.ru/docs/ru/sber-api/host/statements
}

interface StatementTransactionsV2 {
  _links: Link[];
  transactions: StatementTransactionV2[];
}

// Интерфейс для параметров конфигурации плагина
export const Schema = z.object({});

// Интерфейс для параметров конфигурации плагина
export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

export class SberpollPlugin extends PollingProvider {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    @Inject(PAYMENT_STATE_REPOSITORY) private readonly paymentStateRepository: PaymentStateRepository,
    private readonly logger: WinstonLoggerService,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort,
    @Inject(REDIS_PORT) private readonly redisPort: RedisPort
  ) {
    super();
    this.logger.setContext(SberpollPlugin.name);
  }

  name = 'sberpoll';
  plugin!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  public tolerance_percent = 0; /// (0.0005%) < Допустимая погрешность приёма платежей
  public fee_percent = 0; ///%

  async initialize(): Promise<void> {
    const pluginData = await this.extensionRepository.findByName(this.name);

    if (!pluginData) throw new Error('Конфиг не найден');

    this.plugin = pluginData;

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.plugin);
  }

  public async createPayment(hash: string): Promise<PaymentDetailsDomainInterface> {
    // Получаем данные платежа по hash
    const payment = await this.paymentRepository.findByHash(hash);

    if (!payment) {
      throw new Error(`Платеж с hash ${hash} не найден`);
    }

    const amount = payment.quantity;
    const symbol = payment.symbol;

    // eslint-disable-next-line prettier/prettier
    const cooperative = await this.generatorPort.constructCooperative(config.coopname);
    const amount_plus_fee = getAmountPlusFee(amount, this.fee_percent).toFixed(2);
    const fee_amount = (parseFloat(amount_plus_fee) - amount).toFixed(2);
    const fact_fee_percent = Math.round((parseFloat(fee_amount) / amount) * 100 * 100) / 100;

    const paymentMethod = (await this.generatorPort.get('paymentMethod', {
      username: config.coopname,
      method_type: 'bank_transfer',
      is_default: true,
    })) as Cooperative.Payments.IPaymentData;

    const bankAccount = paymentMethod.data as Cooperative.Payments.IBankAccount;

    const description = payment.memo || `Платеж для ${payment.username}`;

    const invoice = `ST00012|Name=${cooperative?.full_name}|PersonalAcc=${bankAccount.account_number}|BankName=${
      bankAccount.bank_name
    }|BIC=${bankAccount.details.bik}|CorrespAcc=${bankAccount.details.corr}|Sum=${parseInt(
      amount_plus_fee
    )}00|Purpose=${description}|PayeeINN=${cooperative?.details.inn}|KPP=${cooperative?.details.kpp}`;

    const result: PaymentDetailsDomainInterface = {
      data: invoice,
      amount_plus_fee: `${amount_plus_fee} ${symbol}`,
      amount_without_fee: `${amount} ${symbol}`,
      fee_amount: `${fee_amount} ${symbol}`,
      fee_percent: this.fee_percent,
      fact_fee_percent,
      tolerance_percent: this.tolerance_percent,
    };

    return result;
  }

  private getAccessToken(): string {
    // Реализуйте получение токена доступа
    return 'YOUR_ACCESS_TOKEN';
  }

  private extractOrderNumber(paymentPurpose: string): string {
    const regex = /№(\d+)/;
    const match = paymentPurpose.match(regex);
    if (match && match[1]) {
      return match[1];
    }
    return '';
  }

  private getApiUrl(): string {
    return `https://api.sberbank.ru/fintech/api/v2/statement/transactions`;
  }

  private getAccountNumber(): string {
    return 'ВАШ_НОМЕР_СЧЕТА';
  }

  private getStatementDate(): string {
    return '2023-10-01';
  }

  public async sync(): Promise<void> {
    const accessToken = await this.getAccessToken();
    const accountNumber = this.getAccountNumber();
    const statementDate = this.getStatementDate();

    // Загрузка состояния обработки
    let paymentState = await this.paymentStateRepository.findOne(accountNumber, statementDate);

    // Если состояния нет, создаем новое
    if (!paymentState) {
      paymentState = await this.paymentStateRepository.save({
        accountNumber,
        statementDate,
        lastProcessedPage: 1, // Начинаем с первой страницы
      });
    }

    let hasNextPage = true;
    let page = paymentState.lastProcessedPage; // Начинаем с сохраненной страницы

    // Формирование URL запроса
    const url = this.getApiUrl();

    while (hasNextPage) {
      // Параметры запроса
      const params = {
        accountNumber,
        statementDate,
        page,
      };

      try {
        // Выполнение запроса к API
        const response = await axios.get<StatementTransactionsV2>(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          params,
        });

        const data = response.data;

        // Обработка транзакций
        const transactions = data.transactions || [];

        for (const transaction of transactions) {
          // Извлечение номера заказа из назначения платежа
          const orderNumber = this.extractOrderNumber(transaction.paymentPurpose);

          if (!orderNumber) {
            this.logger.warn(
              `Не найден номер заказа в строке назначения платежа: ${transaction.paymentPurpose} транзакции ${transaction.id}`
            );
            continue; // Переходим к следующей транзакции
          }

          this.logger.info(`Обработка транзакции ${transaction.id} с номером заказа ${orderNumber}`);

          // Ищем платеж по memo, который содержит номер заказа
          // или по другому подходящему полю
          const payments = await this.paymentRepository.getAllPayments(
            {
              direction: PaymentDirectionEnum.INCOMING,
              status: PaymentStatusEnum.PENDING,
            },
            { limit: 100, page: 1, sortOrder: 'ASC' }
          );

          // Ищем платеж, у которого в memo или id содержится номер заказа
          const payment = payments.items.find(
            (p) => p.memo?.includes(orderNumber) || p.id?.includes(orderNumber) || p.hash?.includes(orderNumber)
          );

          if (!payment) {
            this.logger.warn(`Не найден платеж с номером заказа ${orderNumber} по транзакции ${transaction.id}`);
            continue; // Переходим к следующей транзакции
          }

          const symbol = payment.symbol;
          const symbol_check = checkPaymentSymbol(transaction.amountRub.currencyName, symbol);

          if (symbol_check.status === 'error') {
            this.logger.warn(symbol_check.message);
            if (payment.id) {
              await this.paymentRepository.update(payment.id, {
                status: PaymentStatusEnum.FAILED,
                message: symbol_check.message,
              });
              await this.redisPort.publish(
                `${config.coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatusEnum.FAILED })
              );
            }
            continue; // Переходим к следующей транзакции
          }

          // Платеж найден, проверяем сумму платежа
          const amount_check = checkPaymentAmount(
            parseFloat(transaction.amountRub.amount),
            payment.quantity,
            this.tolerance_percent
          );

          if (amount_check.status === 'error') {
            this.logger.warn(amount_check.message);
            if (payment.id) {
              await this.paymentRepository.update(payment.id, {
                status: PaymentStatusEnum.FAILED,
                message: amount_check.message,
              });
              await this.redisPort.publish(
                `${config.coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatusEnum.FAILED })
              );
            }
            continue; // Переходим к следующей транзакции
          }

          // Отмечаем платеж оплаченным если все проверки пройдены
          if (payment.id) {
            await this.paymentRepository.update(payment.id, { status: PaymentStatusEnum.PAID });
            await this.redisPort.publish(
              `${config.coopname}:orderStatusUpdate`,
              JSON.stringify({ id: payment.id, status: PaymentStatusEnum.PAID })
            );
          }

          this.logger.info(`Платеж ${payment.id} успешно обработан и отмечен как оплаченный`);
        }

        // Обновление состояния после обработки текущей страницы
        await this.paymentStateRepository.save({
          accountNumber,
          statementDate,
          lastProcessedPage: page,
        });

        // Проверка наличия следующей страницы
        const nextLinkObj = data._links?.find((link) => link.rel === 'next');

        if (nextLinkObj) {
          hasNextPage = true;
          page += 1; // Увеличиваем номер страницы на 1
        } else {
          hasNextPage = false;
        }
      } catch (error) {
        this.logger.error(`Ошибка при обработке страницы ${page}: ${error}`);
        hasNextPage = false;
      }
    }

    this.logger.info('Все транзакции обработаны.');
  }
}

@Module({
  imports: [RedisModule],
  providers: [
    SberpollPlugin,
    {
      provide: EXTENSION_REPOSITORY,
      useClass: TypeOrmExtensionDomainRepository,
    },
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentRepository,
    },
  ], // Регистрируем SberpollPlugin как провайдер
  exports: [SberpollPlugin], // Экспортируем его для доступа в других модулях
})
export class SberpollPluginModule {
  constructor(private readonly sberpollPlugin: SberpollPlugin) {}

  async initialize() {
    await this.sberpollPlugin.initialize();
  }
}
