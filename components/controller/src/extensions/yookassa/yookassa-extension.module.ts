import { Module, Inject } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { z } from 'zod';
import config from '~/config/config';
import { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { IPNProvider } from '~/application/gateway/providers/ipn-provider';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { TypeOrmPaymentRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-payment.repository';
import { PaymentEntity } from '~/infrastructure/database/typeorm/entities/payment.entity';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';
import { IPN_REPOSITORY, IpnRepository } from '~/domain/gateway/repositories/ipn.repository';
import type { PaymentDetailsDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import { PAYMENT_REPOSITORY } from '~/domain/gateway/repositories/payment.repository';
import { REDIS_PORT, RedisPort } from '~/domain/common/ports/redis.port';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { ProviderPort, PROVIDER_PORT } from '~/domain/gateway/ports/provider.port';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { TypeOrmExtensionDomainRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-extension.repository';
import { checkPaymentAmount, checkPaymentSymbol, getAmountPlusFee } from '~/shared/utils/payments';

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
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: TypeOrmPaymentRepository,
    @Inject(IPN_REPOSITORY) private readonly ipnRepository: IpnRepository,
    private readonly logger: WinstonLoggerService,
    @Inject(REDIS_PORT) private readonly redisPort: RedisPort,
    @Inject(PROVIDER_PORT) private readonly providerPort: ProviderPort
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

    this.providerPort.registerProvider(this.name, this);
    this.logger.info(`Платежный провайдер ${this.name} успешно зарегистрирован.`);
  }

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  public tolerance_percent = 0; /// (0.0005%) < Допустимая погрешность приёма платежей
  public fee_percent = 3.5; ///%

  public async handleIPN(request: IIpnRequest): Promise<void> {
    const { event } = request;

    const exist = await this.ipnRepository.findOne({ data: { object: { id: request.object.id } } });

    if (!exist) {
      await this.ipnRepository.create({ provider: 'yookassa', data: request });

      const { secret } = request.object.metadata;
      const payments = await this.paymentRepository.getAllPayments(
        {
          secret,
          direction: PaymentDirectionEnum.INCOMING, // Ищем только входящие платежи
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
              await this.paymentRepository.update(payment.id, {
                status: PaymentStatusEnum.FAILED,
                message: symbol_result.message,
              });
              await this.redisPort.publish(
                `${config.coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatusEnum.FAILED })
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
              await this.paymentRepository.update(payment.id, { status: PaymentStatusEnum.PAID });
              await this.redisPort.publish(
                `${config.coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatusEnum.PAID })
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
              await this.paymentRepository.update(payment.id, {
                status: PaymentStatusEnum.FAILED,
                message: result.message,
              });
              await this.redisPort.publish(
                `${config.coopname}:orderStatusUpdate`,
                JSON.stringify({ id: payment.id, status: PaymentStatusEnum.FAILED })
              );
            }
          }
        } else if (event === 'payment.failed') {
          // Обработка неудачного платежа
          this.logger.warn('Получено событие неудачного платежа', { source: 'handleIPN', id: payment.id });

          if (payment.id) {
            await this.paymentRepository.update(payment.id, { status: PaymentStatusEnum.FAILED });
            this.redisPort.publish(
              `${config.coopname}:orderStatusUpdate`,
              JSON.stringify({ id: payment.id, status: PaymentStatusEnum.FAILED })
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

  public async createPayment(hash: string): Promise<PaymentDetailsDomainInterface> {
    // Получаем данные платежа по hash
    const payment = await this.paymentRepository.findByHash(hash);

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
  imports: [TypeOrmModule.forFeature([PaymentEntity]), RedisModule, GatewayDomainModule, GatewayInfrastructureModule],
  providers: [
    YookassaExtension,
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentRepository,
    },
    {
      provide: EXTENSION_REPOSITORY,
      useClass: TypeOrmExtensionDomainRepository,
    },
  ],
  exports: [YookassaExtension],
})
export class YookassaExtensionModule {
  constructor(private readonly yookassaExtension: YookassaExtension) {}

  async initialize() {
    await this.yookassaExtension.initialize();
  }
}
