
import { Inject, Module } from '@nestjs/common';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
  platformSettings,
  getAmountPlusFee,
  PaymentProvider,
  type PaymentDetails,
} from '@coopenomics/extension-kit';
import { TypeOrmExtensionDomainRepository } from '~/infrastructure/database/typeorm/repositories/typeorm-extension.repository';
import {
  LOGGER_PORT,
  type ILoggerPort,
  PAYMENT_PORT,
  type IPaymentPort,
  PAYMENT_PROVIDER_REGISTRY_PORT,
  type IPaymentProviderRegistryPort,
  ORGANIZATION_PORT,
  type IOrganizationPort,
  PAYMENT_METHOD_PORT,
  type IPaymentMethodPort,
  type InnerBankTransferData,
} from '@coopenomics/innercoop';
import type { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import { z } from 'zod';
import type { Cooperative } from 'cooptypes';

// Дефолтные параметры конфигурации
export const defaultConfig = {};

export const Schema = z.object({});
// eslint-disable-next-line @typescript-eslint/no-empty-interface

// Интерфейс для параметров конфигурации расширения
export type IConfig = z.infer<typeof Schema>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ILog {}

export class QrPayExtension extends PaymentProvider {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(PAYMENT_PORT) private readonly payments: IPaymentPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    @Inject(ORGANIZATION_PORT) private readonly organizations: IOrganizationPort,
    @Inject(PAYMENT_METHOD_PORT) private readonly paymentMethods: IPaymentMethodPort,
    @Inject(PAYMENT_PROVIDER_REGISTRY_PORT) private readonly providerRegistry: IPaymentProviderRegistryPort
  ) {
    super();
    this.logger.setContext(QrPayExtension.name);
  }

  name = 'qrpay';

  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  public tolerance_percent = 0; /// (0.0005%) < Допустимая погрешность приёма платежей
  public fee_percent = 0; ///%

  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error('Конфиг не найден');

    this.extension = extensionData;

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.extension);

    this.providerRegistry.registerProvider(this.name, this);
    this.logger.log(`Платежный провайдер ${this.name} успешно зарегистрирован.`);
  }

  public async createPayment(hash: string): Promise<PaymentDetails> {
    // Получаем данные платежа по hash
    const payment = await this.payments.findByHash(hash);

    if (!payment) {
      throw new Error(`Платеж с hash ${hash} не найден`);
    }

    const amount = payment.quantity;
    const symbol = payment.symbol;

    const cooperative = await this.organizations.findByUsername(platformSettings().coopname);
    const amount_plus_fee = getAmountPlusFee(amount, this.fee_percent).toFixed(2);
    const fee_amount = (parseFloat(amount_plus_fee) - amount).toFixed(2);
    const fact_fee_percent = Math.round((parseFloat(fee_amount) / amount) * 100 * 100) / 100;

    const paymentMethod = await this.paymentMethods.get({
      username: platformSettings().coopname,
      method_type: 'bank_transfer',
      is_default: true,
    });

    const bankAccount = paymentMethod.data as InnerBankTransferData;

    const description = payment.memo || `Платеж для ${payment.username}`;

    const invoice = `ST00012|Name=${cooperative?.full_name}|PersonalAcc=${bankAccount.account_number}|BankName=${
      bankAccount.bank_name
    }|BIC=${bankAccount.details.bik}|CorrespAcc=${bankAccount.details.corr}|Sum=${parseInt(
      amount_plus_fee
    )}00|Purpose=${description}|PayeeINN=${cooperative?.details.inn}|KPP=${cooperative?.details.kpp}`;

    const result: PaymentDetails = {
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
  providers: [
    QrPayExtension,
    {
      provide: EXTENSION_REPOSITORY, // токен для инъекции
      useClass: TypeOrmExtensionDomainRepository, // Реализация для интерфейса
    },
  ], // Регистрируем PowerupExtension как провайдер
  exports: [QrPayExtension], // Экспортируем его для доступа в других модулях
})
export class QrPayExtensionModule {
  constructor(private readonly qrPayExtension: QrPayExtension) {}

  async initialize() {
    await this.qrPayExtension.initialize();
  }
}
