import { Module, Inject } from '@nestjs/common';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { z } from 'zod';
import {
  ExtensionDomainEntity,
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
  platformSettings,
  checkPaymentAmount,
  checkPaymentSymbol,
  getAmountPlusFee,
  IPNProvider,
  type PaymentDetails,
} from '@coopenomics/extension-kit';
import {
  LOGGER_PORT,
  type ILoggerPort,
  MESSAGE_CHANNEL_PORT,
  type IMessageChannelPort,
  PAYMENT_PORT,
  type IPaymentPort,
  PAYMENT_NOTICE_LOG_PORT,
  type IPaymentNoticeLogPort,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type IPaymentProviderRegistryPort,
  PaymentStatus,
  PaymentDirection,
} from '@coopenomics/innercoop';

export const Schema = z.object({
  client: z.string(),
  secret: z.string(),
});

export const defaultConfig = {
  client: '',
  secret: '',
};

interface IIpnRequest {
  event: string;
  object: {
    [x: string]: unknown;
    amount: {
      [x: string]: unknown;
      currency: string;
      value: string;
    };
    authorization_details?: {
      [x: string]: unknown;
      auth_code?: string;
      rrn?: string;
      three_d_secure?: {
        [x: string]: unknown;
        applied?: boolean;
      };
    };
    created_at?: string;
    description?: string;
    expires_at?: string;
    id: string;
    income_amount: {
      [x: string]: unknown;
      currency: string;
      value: string;
    };
    metadata: {
      secret: string;
      [x: string]: unknown;
    };
    paid: boolean;
    payment_method: {
      [x: string]: unknown;
      card?: {
        [x: string]: unknown;
        card_type?: string;
        expiry_month?: string;
        expiry_year?: string;
        first6?: string;
        issuer_country?: string;
        issuer_name?: string;
        last4?: string;
      };
      id: string;
      saved?: boolean;
      title?: string;
      type: string;
    };
    refundable?: boolean;
    refunded_amount: {
      [x: string]: unknown;
      currency: string;
      value: string;
    };
    status: string;
    test?: boolean;
  };
  type: string;
}

export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

export class YookassaExtension extends IPNProvider {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(PAYMENT_PORT) private readonly payments: IPaymentPort,
    @Inject(PAYMENT_NOTICE_LOG_PORT) private readonly noticeLog: IPaymentNoticeLogPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(MESSAGE_CHANNEL_PORT) private readonly messageChannel: IMessageChannelPort,
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT) private readonly providerRegistry: IPaymentProviderRegistryPort
  ) {
    super();
    this.logger.setContext(YookassaExtension.name);
  }

  name = 'yookassa';
  extension!: ExtensionDomainEntity<IConfig>;

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг не найден');

    this.extension = extensionData;

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.extension.config);

    this.providerRegistry.registerProvider(this.name, this);
    this.logger.info(`Платежный провайдер ${this.name} успешно зарегистрирован.`);
  }

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  public tolerance_percent = 0; /// (0.0005%) < Допустимая погрешность приёма платежей
  public fee_percent = 3.5; ///%

  public async handleIPN(request: IIpnRequest): Promise<void> {
    const { event } = request;

    const exist = await this.noticeLog.find({ data: { object: { id: request.object.id } } });

    if (!exist) {
      await this.noticeLog.record({ provider: 'yookassa', data: request });

      const { secret } = request.object.metadata;
      const payments = await this.payments.list(
        {
          secret,
          direction: PaymentDirection.INCOMING, // Ищем только входящие платежи
        },
        { limit: 1, page: 1, sortOrder: 'DESC' }
      );
      const payment = payments.items[0];

      if (payment) {
        this.logger.info('Платеж найден', { source: 'handleIPN', id: payment.id });

        if (event === 'payment.succeeded') {
          const symbol = payment.symbol;

          const symbol_result = checkPaymentSymbol(request.object.income_amount.currency, symbol);

          if (symbol_result.status == 'error') {
            this.logger.warn('Проверка символа платежа не удалась', {
              source: 'handleIPN',
              id: payment.id,
              message: symbol_result.message,
            });

            if (payment.id) {
              await this.payments.update(payment.id, {
                status: PaymentStatus.FAILED,
                message: symbol_result.message,
              });
              await this.messageChannel.publish(
                `${platformSettings().coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatus.FAILED })
              );
            }
            return;
          }

          const result = checkPaymentAmount(
            parseFloat(request.object.income_amount.value),
            payment.quantity,
            this.tolerance_percent
          );

          if (result.status === 'success') {
            // Обработка успешного платежа
            this.logger.info('Сумма платежа проверена, обновляется статус платежа на оплаченный', {
              source: 'handleIPN',
              id: payment.id,
            });

            if (payment.id) {
              await this.payments.update(payment.id, { status: PaymentStatus.PAID });
              await this.messageChannel.publish(
                `${platformSettings().coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatus.PAID })
              );
            }
          } else {
            // Обработка неудачного платежа
            this.logger.warn('Проверка суммы платежа не удалась', {
              source: 'handleIPN',
              id: payment.id,
              message: result.message,
            });

            if (payment.id) {
              await this.payments.update(payment.id, {
                status: PaymentStatus.FAILED,
                message: result.message,
              });
              await this.messageChannel.publish(
                `${platformSettings().coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatus.FAILED })
              );
            }
          }
        } else if (event === 'payment.failed') {
          // Обработка неудачного платежа
          this.logger.warn('Получено событие неудачного платежа', { source: 'handleIPN', id: payment.id });

          if (payment.id) {
            await this.payments.update(payment.id, { status: PaymentStatus.FAILED });
            this.messageChannel.publish(
              `${platformSettings().coopname}:orderStatusUpdate`,
              JSON.stringify({ id: payment.id, status: PaymentStatus.FAILED })
            );
          }
        }
      } else {
        //TODO платеж есть, а ордера на него нет. Что делаем?
        this.logger.error('Платеж существует, но заказ не найден', undefined, {
          source: 'handleIPN',
          requestId: request.object.id,
        });
      }
    } else {
      this.logger.warn('IPN уже обработан', { source: 'handleIPN', requestId: request.object.id });
    }
  }

  public async createPayment(hash: string): Promise<PaymentDetails> {
    // Получаем данные платежа по hash
    const payment = await this.payments.findByHash(hash);

    if (!payment) {
      throw new Error(`Платеж с hash ${hash} не найден`);
    }

    // Используем QuantityUtils для парсинга quantity
    const symbol = payment.symbol;
    const amount = payment.quantity;

    if (!payment.secret) {
      throw new Error(`У платежа ${hash} отсутствует secret`);
    }

    const checkout = new YooCheckout({
      shopId: this.extension.config.client,
      secretKey: this.extension.config.secret,
    });

    const amount_plus_fee = getAmountPlusFee(amount, this.fee_percent).toFixed(2);
    const fee_amount = (parseFloat(amount_plus_fee) - amount).toFixed(2);

    // Фактический процент комиссии
    const fact_fee_percent = Math.round((parseFloat(fee_amount) / amount) * 100 * 100) / 100;

    const description = payment.memo || `Платеж для ${payment.username}`;

    const payment_result = await checkout.createPayment(
      {
        description,
        amount: {
          value: amount_plus_fee,
          currency: symbol,
        },
        confirmation: {
          type: 'embedded',
        },
        metadata: {
          secret: payment.secret,
        },
        capture: true,
      },
      payment.secret
    );

    return {
      data: payment_result?.confirmation?.confirmation_token || '',
      amount_plus_fee: `${amount_plus_fee} ${symbol}`,
      amount_without_fee: `${amount} ${symbol}`,
      fee_amount: `${fee_amount} ${symbol}`,
      fee_percent: this.fee_percent,
      fact_fee_percent,
      tolerance_percent: this.tolerance_percent,
    };
  }
}

@Module({
  providers: [
    YookassaExtension,
  ],
  exports: [YookassaExtension],
})
export class YookassaExtensionModule {
  constructor(private readonly yookassaExtension: YookassaExtension) {}

  async initialize() {
    await this.yookassaExtension.initialize();
  }
}
