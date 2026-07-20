import type { PaymentDetailsDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import { GENERATOR_PORT, GeneratorPort } from '~/domain/document/ports/generator.port';
import { getAmountPlusFee } from '~/shared/utils/payments';

import { PaymentProvider } from '~/application/gateway/providers/payment-provider';
import { Inject, Module } from '@nestjs/common';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { TypeOrmExtensionDomainRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-extension.repository';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { z } from 'zod';
import config from '~/config/config';
import type { Cooperative } from 'cooptypes';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { TypeOrmPaymentRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-payment.repository';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { ProviderPort, PROVIDER_PORT } from '~/domain/gateway/ports/provider.port';

// Дефолтные параметры конфигурации
export const defaultConfig = {};

export const Schema = z.object({});
// eslint-disable-next-line @typescript-eslint/no-empty-interface

// Интерфейс для параметров конфигурации плагина
export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

export class QrPayPlugin extends PaymentProvider {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(PAYMENT_REPOSITORY) private readonly paymentRepository: PaymentRepository,
    private readonly logger: WinstonLoggerService,
    @Inject(GENERATOR_PORT) private readonly generatorPort: GeneratorPort,
    @Inject(PROVIDER_PORT) private readonly providerPort: ProviderPort
  ) {
    super();
    this.logger.setContext(QrPayPlugin.name);
  }

  name = 'qrpay';

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

    this.providerPort.registerProvider(this.name, this);
    this.logger.log(`Платежный провайдер ${this.name} успешно зарегистрирован.`);
  }

  public async createPayment(hash: string): Promise<PaymentDetailsDomainInterface> {
    // Получаем данные платежа по hash
    const payment = await this.paymentRepository.findByHash(hash);

    if (!payment) {
      throw new Error(`Платеж с hash ${hash} не найден`);
    }

    const amount = payment.quantity;
    const symbol = payment.symbol;

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
      amount_without_fee: `${amount.toFixed(2)} ${symbol}`,
      fee_amount: `${fee_amount} ${symbol}`,
      fee_percent: this.fee_percent,
      fact_fee_percent,
      tolerance_percent: this.tolerance_percent,
    };

    return result;
  }
}

@Module({
  imports: [GatewayDomainModule, GatewayInfrastructureModule],
  providers: [
    QrPayPlugin,
    {
      provide: EXTENSION_REPOSITORY, // токен для инъекции
      useClass: TypeOrmExtensionDomainRepository, // Реализация для интерфейса
    },
    {
      provide: PAYMENT_REPOSITORY,
      useClass: TypeOrmPaymentRepository,
    },
  ], // Регистрируем PowerupPlugin как провайдер
  exports: [QrPayPlugin], // Экспортируем его для доступа в других модулях
})
export class QrPayPluginModule {
  constructor(private readonly qrPayPlugin: QrPayPlugin) {}

  async initialize() {
    await this.qrPayPlugin.initialize();
  }
}
