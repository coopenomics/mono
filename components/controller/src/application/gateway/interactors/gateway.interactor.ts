import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import type { SetPaymentStatusInputDomainInterface } from '~/domain/gateway/interfaces/set-payment-status-domain-input.interface';
import type { InternalPaymentFiltersDomainInterface } from '~/domain/gateway/interfaces/payment-filters-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaymentDomainEntity } from '~/domain/gateway/entities/payment-domain.entity';
import { GatewayBlockchainPort, GATEWAY_BLOCKCHAIN_PORT } from '~/domain/gateway/ports/gateway-blockchain.port';
import { PaymentRepository, PAYMENT_REPOSITORY } from '~/domain/gateway/repositories/payment.repository';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentDirectionEnum, PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import type { PaymentDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import type { CreateInitialPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-initial-payment-input-domain.interface';
import type { CreateDepositPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-deposit-payment-input-domain.interface';
import type { CreateWithdrawPaymentInputDomainInterface } from '~/domain/gateway/interfaces/create-withdraw-payment-input-domain.interface';
import config from '~/config/config';
import type { CompleteIncomeDomainInterface } from '~/domain/gateway/interfaces/complete-income-domain.interface';
import type { CompleteOutcomeDomainInterface } from '~/domain/gateway/interfaces/complete-outcome-domain.interface';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import { ProviderPort, PROVIDER_PORT } from '~/domain/gateway/ports/provider.port';
import { QuantityUtils } from '~/shared/utils/quantity.utils';
import { SystemDomainPort, SYSTEM_DOMAIN_PORT } from '~/domain/system/interfaces/system-domain.port';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from '~/domain/account/services/account-domain.service';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { PaymentMethodRepository, PAYMENT_METHOD_REPOSITORY } from '~/domain/common/repositories/payment-method.repository';
import type { PaymentDetailsDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import { AccountDomainPort, ACCOUNT_DOMAIN_PORT } from '~/domain/account/ports/account-domain.port';

/**
 * Интерактор домена gateway для управления платежами (просмотр, изменение статуса и создание)
 *
 * Особенности работы с истечением платежей:
 * - Все новые платежи (регистрация и депозит) автоматически получают срок истечения +24 часа
 * - При создании нового платежа проверяется наличие активного платежа того же типа
 * - Истекшие платежи автоматически обновляются в статус EXPIRED при создании новых платежей
 * - Доступен отдельный метод expireOutdatedPayments() для периодической очистки
 */
@Injectable()
export class GatewayInteractor {
  private readonly logger = new Logger(GatewayInteractor.name);

  constructor(
    @Inject(GATEWAY_BLOCKCHAIN_PORT)
    private readonly gatewayBlockchainPort: GatewayBlockchainPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly paymentRepository: PaymentRepository,
    @Inject(ACCOUNT_DOMAIN_PORT)
    private readonly accountDomainPort: AccountDomainPort,
    @Inject(PROVIDER_PORT)
    private readonly providerPort: ProviderPort,
    @Inject(SYSTEM_DOMAIN_PORT)
    private readonly systemDomainPort: SystemDomainPort,
    @Inject(ACCOUNT_DOMAIN_SERVICE)
    private readonly accountDomainService: AccountDomainService,
    @Inject(PAYMENT_METHOD_REPOSITORY)
    private readonly paymentMethodRepository: PaymentMethodRepository
  ) {}

  /**
   * Создать дату истечения платежа
   * @param hours количество часов до истечения. -1 = бессрочный платеж
   * @returns дата истечения
   */
  private createPaymentExpirationDate(hours: number): Date | undefined {
    if (hours === -1) {
      return undefined; // Бессрочный платеж
    }
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  /**
   * Получить платежи с фильтрацией (универсальный метод с поддержкой секрета)
   */
  async getPayments(
    filters: InternalPaymentFiltersDomainInterface,
    options: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<PaymentDomainEntity>> {
    const result = await this.paymentRepository.getAllPayments(filters, options);

    // Преобразуем результаты в доменные сущности
    const items = result.items.map((item) => new PaymentDomainEntity(item));

    return {
      items,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  /**
   * Установить статус платежа (работает для входящих и исходящих платежей)
   */
  async setPaymentStatus(data: SetPaymentStatusInputDomainInterface): Promise<PaymentDomainEntity> {
    try {
      const payment = await this.paymentRepository.findById(data.id);
      if (!payment) {
        throw new NotFoundException(`Не удалось найти платеж с ID ${data.id}`);
      }

      const paymentEntity = new PaymentDomainEntity(payment);
      const statusEnum = data.status as unknown as PaymentStatusEnum;

      // Проверяем можно ли изменить статус
      if (!paymentEntity.canChangeStatus()) {
        throw new Error(`Невозможно изменить статус платежа с текущим статусом: ${payment.status}`);
      }

      const result = await this.paymentRepository.setPaymentStatus(data.id, statusEnum);

      if (!result) {
        throw new NotFoundException(`Не удалось найти платеж с ID ${data.id}`);
      }

      // Обрабатываем платеж при статусе PAID
      if (statusEnum === PaymentStatusEnum.PAID) {
        if (result.direction === PaymentDirectionEnum.INCOMING) {
          // Обработка входящих платежей
          await this.processIncomingPayment(result);
        } else if (result.direction === PaymentDirectionEnum.OUTGOING) {
          // Обработка исходящих платежей
          await this.processOutgoingPayment(result);
        }
      }

      return new PaymentDomainEntity(result);
    } catch (error: any) {
      this.logger.error(`Не удалось обновить статус платежа: ${error.message}`);
      throw new NotFoundException(`Не удалось найти платеж с ID ${data.id}`);
    }
  }

  /**
   * Выполнить процессинг платежа
   */
  async executeIncomePayment(id: string, status: PaymentStatusEnum) {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) {
      this.logger.error(`Платеж с ID ${id} не найден`);
      return;
    }

    if (status === PaymentStatusEnum.PAID && payment.status !== PaymentStatusEnum.COMPLETED) {
      await this.processIncomingPayment(payment);
    } else {
      this.logger.warn(`Платеж с ID ${id} имеет статус ${status}, пропускаем обработку`);
    }
  }

  /**
   * Обработка входящих платежей
   */
  private async processIncomingPayment(payment: PaymentDomainInterface) {
    this.logger.log(`Обрабатываем входящий платеж ${payment.id}`);

    try {
      if (payment.type === PaymentTypeEnum.REGISTRATION) {
        await this.accountDomainPort.registerBlockchainAccount(payment.username);
        this.logger.log(`Новый пользователь зарегистрирован: ${payment.username}`);
        if (payment.id) {
          await this.paymentRepository.update(payment.id, { status: PaymentStatusEnum.COMPLETED });
        }
      } else if (payment.type === PaymentTypeEnum.DEPOSIT) {
        // Парсим quantity и форматируем для блокчейна с правильным precision
        const blockchainFormattedQuantity = QuantityUtils.formatQuantityForBlockchain(payment.quantity, payment.symbol);

        const completeIncomeData: CompleteIncomeDomainInterface = {
          coopname: payment.coopname,
          username: payment.username,
          quantity: blockchainFormattedQuantity,
          income_hash: payment.hash,
        };
        await this.gatewayBlockchainPort.completeIncome(completeIncomeData);
        if (payment.id) {
          await this.paymentRepository.update(payment.id, { status: PaymentStatusEnum.COMPLETED });
        }
        this.logger.log(`Пользователь ${payment.username} внес паевой взнос на сумму ${blockchainFormattedQuantity}`);
      }
    } catch (e: any) {
      if (payment.id) {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatusEnum.FAILED,
          message: e.message,
        });
      }
      this.logger.error(`Ошибка обработки входящего платежа: ${payment.id}, сообщение: ${e.message}`, e);
    }
  }

  /**
   * Обработка исходящих платежей
   */
  private async processOutgoingPayment(payment: PaymentDomainInterface) {
    this.logger.log(`Обрабатываем исходящий платеж ${payment.id}`);

    try {
      const completeOutcomeData: CompleteOutcomeDomainInterface = {
        coopname: payment.coopname,
        outcome_hash: payment.hash,
      };

      await this.gatewayBlockchainPort.completeOutcome(completeOutcomeData);

      if (payment.id) {
        await this.paymentRepository.update(payment.id, { status: PaymentStatusEnum.COMPLETED });
      }

      this.logger.log(`Завершен исходящий платеж: ${payment.hash} для пользователя ${payment.username}`);
    } catch (e: any) {
      console.error(e);
      if (payment.id) {
        await this.paymentRepository.update(payment.id, {
          status: PaymentStatusEnum.FAILED,
          message: e.message,
        });
      }
      this.logger.error(`Ошибка обработки исходящего платежа: ${payment.id}, сообщение: ${e.message}`, e);
    }
  }

  /**
   * Создать регистрационный платеж
   */
  async createInitialPayment(data: CreateInitialPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    // Обновляем истекшие платежи перед созданием нового
    await this.paymentRepository.expireOutdatedPayments();

    // Получаем информацию о системе для извлечения сумм платежей
    const systemInfo = await this.systemDomainPort.getInfo();
    const cooperatorAccount = systemInfo.cooperator_account;

    // Получаем информацию об аккаунте пользователя для определения типа
    const userAccount = await this.accountDomainService.getAccount(data.username);

    if (!userAccount.private_account) {
      throw new Error(`Не удалось определить тип аккаунта для пользователя ${data.username}`);
    }

    // Определяем сумму платежа на основе типа аккаунта
    let registrationAmount: string;
    if (userAccount.private_account.type === AccountType.organization) {
      registrationAmount = cooperatorAccount.org_registration;
    } else {
      // Для individual и entrepreneur используем обычную сумму registration
      registrationAmount = cooperatorAccount.registration;
    }

    // Парсим количество и символ из строки суммы
    const { amount, symbol } = QuantityUtils.parseQuantityString(registrationAmount);

    // Валидируем символ
    QuantityUtils.validateSymbol(symbol);

    // Проверяем, нет ли уже активного платежа этого типа для пользователя с такой же суммой
    const existingPayment = await this.paymentRepository.findActivePendingPayment(
      data.username,
      PaymentTypeEnum.REGISTRATION,
      amount,
      symbol
    );

    if (existingPayment) {
      this.logger.log(
        `Найден существующий активный регистрационный платеж для пользователя ${data.username} на сумму ${amount} ${symbol}`
      );
      return new PaymentDomainEntity(existingPayment, { isNewlyCreated: false });
    }

    // Получаем настройки для определения провайдера
    const settings = await this.systemDomainPort.getSettings();
    const provider = settings.provider_name;

    const secret = generateUniqueHash();
    const hash = generateUniqueHash();
    const now = new Date();
    const expiredAt = this.createPaymentExpirationDate(-1); // Бессрочный платеж для вступительных взносов

    const paymentData: PaymentDomainInterface = {
      id: '', // будет установлен в репозитории
      coopname: config.coopname,
      username: data.username,
      quantity: amount,
      symbol: symbol,
      secret,
      type: PaymentTypeEnum.REGISTRATION,
      direction: PaymentDirectionEnum.INCOMING,
      provider,
      status: PaymentStatusEnum.PENDING,
      memo: `Вступительный и минимальный паевой взносы №${hash.slice(0, 8)}`,
      payment_method_id: undefined,
      expired_at: expiredAt,
      created_at: now,
      updated_at: now,
      hash,
    };

    // Создаем платеж в базе данных
    const createdPayment = await this.paymentRepository.create(paymentData);

    if (!createdPayment.id) {
      throw new Error('Не удалось создать платеж - отсутствует ID');
    }

    // Получаем провайдер и создаем платежные детали
    const paymentProvider = this.providerPort.getProvider(provider);
    if (!paymentProvider) {
      throw new Error(`Провайдер ${provider} не найден`);
    }

    try {
      const paymentDetails = await paymentProvider.createPayment(hash);

      // Обновляем платеж с деталями
      await this.paymentRepository.update(createdPayment.id, {
        payment_details: paymentDetails,
      });

      // Возвращаем обновленный платеж
      const updatedPayment = await this.paymentRepository.findById(createdPayment.id);
      if (!updatedPayment) {
        throw new Error(`Не удалось найти обновленный платеж с ID ${createdPayment.id}`);
      }
      return new PaymentDomainEntity(updatedPayment, { isNewlyCreated: true });
    } catch (error: any) {
      this.logger.error(`Ошибка при создании платежных деталей: ${error.message}`);
      // Если не удалось создать детали платежа, помечаем платеж как неудачный
      await this.paymentRepository.update(createdPayment.id, {
        status: PaymentStatusEnum.FAILED,
        message: `Ошибка создания платежа: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Создать депозитный платеж
   */
  async createDeposit(data: CreateDepositPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    // Обновляем истекшие платежи перед созданием нового
    await this.paymentRepository.expireOutdatedPayments();

    // Валидируем символ перед созданием платежа
    QuantityUtils.validateSymbol(data.symbol);

    // Проверяем, нет ли уже активного платежа этого типа для пользователя с такой же суммой
    const existingPayment = await this.paymentRepository.findActivePendingPayment(
      data.username,
      PaymentTypeEnum.DEPOSIT,
      data.quantity,
      data.symbol
    );

    if (existingPayment) {
      this.logger.log(
        `Найден существующий активный депозитный платеж для пользователя ${data.username} на сумму ${data.quantity} ${data.symbol}`
      );
      return new PaymentDomainEntity(existingPayment, { isNewlyCreated: false });
    }

    // Получаем настройки для определения провайдера
    const settings = await this.systemDomainPort.getSettings();
    const provider = settings.provider_name;

    const secret = generateUniqueHash();
    const hash = generateUniqueHash();
    const now = new Date();
    const expiredAt = this.createPaymentExpirationDate(-1); // Бессрочный платеж для паевых взносов

    const paymentData: PaymentDomainInterface = {
      id: '', // будет установлен в репозитории
      coopname: config.coopname,
      username: data.username,
      quantity: data.quantity,
      symbol: data.symbol,
      type: PaymentTypeEnum.DEPOSIT,
      direction: PaymentDirectionEnum.INCOMING,
      provider: provider,
      status: PaymentStatusEnum.PENDING,
      memo: `Паевой взнос по соглашению о ЦПП "Цифровой Кошелёк" №${hash.slice(0, 8)}`,
      secret,
      payment_method_id: undefined,
      expired_at: expiredAt,
      created_at: now,
      updated_at: now,
      hash,
    };

    // Создаем платеж в базе данных
    const createdPayment = await this.paymentRepository.create(paymentData);

    if (!createdPayment.id) {
      throw new Error('Не удалось создать платеж - отсутствует ID');
    }

    // Получаем провайдер и создаем платежные детали
    const paymentProvider = this.providerPort.getProvider(provider);
    if (!paymentProvider) {
      throw new Error(`Провайдер ${provider} не найден`);
    }

    try {
      const paymentDetails = await paymentProvider.createPayment(hash);

      // Обновляем платеж с деталями
      await this.paymentRepository.update(createdPayment.id, {
        payment_details: paymentDetails,
      });

      // Возвращаем обновленный платеж
      const updatedPayment = await this.paymentRepository.findById(createdPayment.id);
      if (!updatedPayment) {
        throw new Error(`Не удалось найти обновленный платеж с ID ${createdPayment.id}`);
      }
      return new PaymentDomainEntity(updatedPayment, { isNewlyCreated: true });
    } catch (error: any) {
      this.logger.error(`Ошибка при создании платежных деталей: ${error.message}`);
      // Если не удалось создать детали платежа, помечаем платеж как неудачный
      await this.paymentRepository.update(createdPayment.id, {
        status: PaymentStatusEnum.FAILED,
        message: `Ошибка создания платежа: ${error.message}`,
      });
      throw error;
    }
  }

  /**
   * Создать исходящий платеж (withdraw)
   */
  async createWithdraw(data: CreateWithdrawPaymentInputDomainInterface): Promise<PaymentDomainEntity> {
    // Обновляем истекшие платежи перед созданием нового
    await this.paymentRepository.expireOutdatedPayments();

    // Валидируем символ перед созданием платежа
    QuantityUtils.validateSymbol(data.symbol);

    // Проверяем, нет ли уже платежа с таким же хешем - это ошибка
    const existingPayment = await this.paymentRepository.findByHash(data.payment_hash);

    if (existingPayment) {
      throw new Error(`Платеж с хешем ${data.payment_hash} уже существует. Возможно, заявка была создана ранее.`);
    }

    // Получаем настройки для определения провайдера
    const settings = await this.systemDomainPort.getSettings();
    const provider = settings.provider_name;

    const now = new Date();
    const expiredAt = this.createPaymentExpirationDate(-1); // Бессрочный платеж для исходящих платежей

    // Получаем данные платежного метода из generator repository
    let paymentDetails: PaymentDetailsDomainInterface;
    try {
      const paymentMethod = await this.paymentMethodRepository.get({
        username: data.username,
        method_id: data.method_id,
      });

      // Формируем payment_details на основе данных платежного метода
      paymentDetails = {
        data: paymentMethod.data,
        // Для исходящих платежей комиссия обычно не применяется
        amount_plus_fee: data.quantity.toString(),
        amount_without_fee: data.quantity.toString(),
        fee_amount: '0',
        fee_percent: 0,
        fact_fee_percent: 0,
        tolerance_percent: 0,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Платежный метод ${data.method_id} для пользователя ${data.username} не найден. Невозможно создать исходящий платеж.`
      );
    }

    const paymentData: PaymentDomainInterface = {
      id: '', // будет установлен в репозитории
      coopname: data.coopname,
      username: data.username,
      quantity: data.quantity,
      symbol: data.symbol,
      type: PaymentTypeEnum.WITHDRAWAL,
      direction: PaymentDirectionEnum.OUTGOING,
      provider: provider,
      status: PaymentStatusEnum.PENDING,
      memo: `Возврат паевого взноса №${data.payment_hash.slice(0, 8)}`,
      secret: generateUniqueHash(),
      payment_method_id: data.method_id,
      payment_details: paymentDetails,
      expired_at: expiredAt,
      created_at: now,
      updated_at: now,
      hash: data.payment_hash, // Используем переданный payment_hash
    };

    // Создаем платеж в базе данных
    const createdPayment = await this.paymentRepository.create(paymentData);

    if (!createdPayment.id) {
      throw new Error('Не удалось создать платеж - отсутствует ID');
    }

    this.logger.log(
      `Создан исходящий платеж ${data.payment_hash} для пользователя ${data.username} на сумму ${data.quantity} ${data.symbol} с платежным методом ${data.method_id}`
    );

    return new PaymentDomainEntity(createdPayment);
  }

  /**
   * Обновить все истекшие платежи в статус EXPIRED
   * Может вызываться периодически или по требованию
   * @returns количество обновленных платежей
   */
  async expireOutdatedPayments(): Promise<number> {
    try {
      const expiredCount = await this.paymentRepository.expireOutdatedPayments();
      if (expiredCount > 0) {
        this.logger.log(`Истекло ${expiredCount} платежей (переведены в статус EXPIRED)`);
      }
      return expiredCount;
    } catch (error: any) {
      this.logger.error(`Ошибка при истечении платежей: ${error.message}`, error);
      return 0;
    }
  }
}
