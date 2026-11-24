import './i18n';
import { Module, Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { z } from 'zod';
import { ExtensionDomainEntity, EXTENSION_REPOSITORY, type ExtensionDomainRepository, describeConfigField, platformSettings, checkPaymentAmount, checkPaymentSymbol, getAmountPlusFee, IPNProvider, type PaymentDetails, DomainError } from '@coopenomics/extension-kit';
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
import { t } from './i18n';

/** Маршрут контроллера, на который ЮKassa шлёт HTTP-уведомления об оплате. */
export const IPN_PATH = '/payment/ipn/yookassa';

/**
 * Схема настроек. Поле `ipn_url` наш сервер не использует: адрес уведомлений
 * задаётся в личном кабинете ЮKassa, передать его через API ключами магазина
 * нельзя. Поле показывает председателю, что вписать в кабинет. Реестр собирает
 * схему в момент запроса: в основной сети адрес — от адреса сервера и только
 * для чтения; на стенде и в тестовой сети его можно заменить (например, на
 * публичный адрес реле до стенда во внутреннем контуре).
 */
export function buildSchema(ipn: { url: string; readonly: boolean } = { url: '', readonly: false }) {
  // Подписи полей формы настроек: без них каталог показывал сырые «client» и
  // «secret», а секретный ключ печатался в поле открытым текстом.
  return z.object({
    client: z.string().describe(
      describeConfigField({
        label: t('yookassa.config.clientLabel'),
        note: t('yookassa.config.clientNote'),
      })
    ),
    secret: z.string().describe(
      describeConfigField({
        label: t('yookassa.config.secretLabel'),
        note: t('yookassa.config.secretNote'),
        password: true,
      })
    ),
    ipn_url: z
      .string()
      .default(ipn.url)
      .describe(
        describeConfigField({
          label: t('yookassa.config.ipnUrlLabel'),
          note: ipn.readonly ? t('yookassa.config.ipnUrlNoteMainnet') : t('yookassa.config.ipnUrlNoteTest'),
          readonly: ipn.readonly,
          copyable: true,
          default: ipn.url,
        })
      ),
    fee_percent: z
      .number()
      .min(0)
      .max(30)
      .default(DEFAULT_FEE_PERCENT)
      .describe(
        describeConfigField({
          label: t('yookassa.config.feePercentLabel'),
          note: t('yookassa.config.feePercentNote'),
        })
      ),
  });
}

/**
 * Комиссия по умолчанию — прежнее зашитое значение. Узнать комиссию магазина
 * до оплаты ЮKassa не даёт (только после, в `income_amount`), поэтому
 * председатель задаёт наибольшую по договору: зачислить пайщику меньше
 * заявленного нельзя.
 */
const DEFAULT_FEE_PERCENT = 3.5;

export const Schema = buildSchema();

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
    if (!extensionData) throw DomainError.internal('YOOKASSA_CONFIG_NOT_FOUND');

    this.extension = extensionData;
    const fee = Number(this.extension.config.fee_percent);
    this.fee_percent = Number.isFinite(fee) ? fee : DEFAULT_FEE_PERCENT;

    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.extension.config);

    this.providerRegistry.registerProvider(this.name, this);
    this.logger.info(`Платежный провайдер ${this.name} успешно зарегистрирован.`);
  }

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  public tolerance_percent = 0; /// (0.0005%) < Допустимая погрешность приёма платежей
  /** Наибольшая комиссия магазина из настроек; задаётся в `initialize`. */
  public fee_percent = DEFAULT_FEE_PERCENT;

  public async handleIPN(notice: IIpnRequest): Promise<void> {
    // Уведомления ЮKassa не подписаны — тело мог прислать кто угодно. Верим
    // только самой ЮKassa: запрашиваем платёж по id своим ключом магазина и
    // дальше работаем с её ответом. Сбой запроса — ошибка обработчика, и
    // ЮKassa повторит уведомление.
    const request = await this.verifyNotice(notice);
    const { event } = request;

    // Незавершённый платёж ничего не меняет и в журнал не пишется: иначе
    // ранняя запись по этому id отбросила бы настоящее уведомление об оплате
    // как «уже обработанное».
    if (event !== 'payment.succeeded' && event !== 'payment.failed') {
      this.logger.info('Платёж ЮKassa ещё не завершён — уведомление пропущено', { source: 'handleIPN', requestId: request.object.id, event });
      return;
    }

    const exist = await this.noticeLog.find({ data: { object: { id: request.object.id } } });

    if (!exist) {
      await this.noticeLog.record({ provider: 'yookassa', data: request });

      const secret = request.object.metadata?.secret;
      // Без секрета платёж не наш: его создавали не мы (ссылка из кабинета ЮKassa,
      // другой сервис того же магазина). Пустой секрет выключил бы фильтр выборки,
      // и оплату получил бы последний входящий платёж любого пайщика.
      if (typeof secret !== 'string' || !secret) {
        this.logger.warn('Платёж ЮKassa без секрета кооператива — уведомление пропущено', {
          source: 'handleIPN',
          requestId: request.object.id,
          event,
        });
        return;
      }
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
                { id: payment.id, status: PaymentStatus.FAILED }
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
              // Сообщение — объектом: порт сериализует его сам. Строка JSON здесь
              // сериализовалась дважды, шлюз получал пустой id, и оплаченный
              // взнос не зачислялся в цепи (24.11.2026).
              await this.messageChannel.publish(
                `${platformSettings().coopname}:orderStatusUpdate`,
                { id: payment.id, status: PaymentStatus.PAID }
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
                { id: payment.id, status: PaymentStatus.FAILED }
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
              { id: payment.id, status: PaymentStatus.FAILED }
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

  /**
   * Уведомление, пересобранное из платежа, полученного у ЮKassa. Событие
   * выводится из фактического статуса: `succeeded` — оплачен, `canceled` —
   * отменён; прочие статусы изменений не несут.
   */
  private async verifyNotice(notice: IIpnRequest): Promise<IIpnRequest> {
    const id = notice?.object?.id;
    if (!id || typeof id !== 'string') throw DomainError.internal('YOOKASSA_NOTICE_MISSING_PAYMENT_ID');

    const actual = await this.checkout().getPayment(id);
    if (!actual || actual.id !== id) throw DomainError.internal('YOOKASSA_PAYMENT_NOT_CONFIRMED', { id });

    const event =
      actual.status === 'succeeded' ? 'payment.succeeded' : actual.status === 'canceled' ? 'payment.failed' : `payment.${actual.status}`;
    if (event !== notice.event) {
      this.logger.warn('Событие уведомления ЮKassa не совпало со статусом платежа', {
        source: 'handleIPN',
        requestId: id,
        notice: notice.event,
        actual: actual.status,
      });
    }

    return {
      ...notice,
      event,
      object: {
        ...(actual as unknown as IIpnRequest['object']),
        income_amount: (actual.income_amount ?? { value: '0', currency: actual.amount?.currency ?? '' }) as IIpnRequest['object']['income_amount'],
        metadata: (actual.metadata ?? {}) as IIpnRequest['object']['metadata'],
      },
    };
  }

  public async createPayment(hash: string): Promise<PaymentDetails> {
    // Получаем данные платежа по hash
    const payment = await this.payments.findByHash(hash);

    if (!payment) {
      throw DomainError.notFound('YOOKASSA_PAYMENT_NOT_FOUND', { hash });
    }

    // Используем QuantityUtils для парсинга quantity
    const symbol = payment.symbol;
    const amount = payment.quantity;

    if (!payment.secret) {
      throw DomainError.internal('YOOKASSA_PAYMENT_SECRET_MISSING', { hash });
    }

    const checkout = this.checkout();

    const amount_plus_fee = getAmountPlusFee(amount, this.fee_percent).toFixed(2);
    const fee_amount = (parseFloat(amount_plus_fee) - amount).toFixed(2);

    // Фактический процент комиссии
    const fact_fee_percent = Math.round((parseFloat(fee_amount) / amount) * 100 * 100) / 100;

    const description = payment.memo || t('yookassa.payment.defaultDescription', { username: payment.username });

    const payment_result = await yookassaCall(() => checkout.createPayment(
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
    ));

    // Номер платежа ЮKassa хранится вместе с платежом: по нему кассир
    // возвращает деньги, если платёж отклонён.
    return {
      data: {
        confirmation_token: payment_result?.confirmation?.confirmation_token || '',
        payment_id: payment_result?.id || '',
      },
      amount_plus_fee: `${amount_plus_fee} ${symbol}`,
      amount_without_fee: `${amount} ${symbol}`,
      fee_amount: `${fee_amount} ${symbol}`,
      fee_percent: this.fee_percent,
      fact_fee_percent,
      tolerance_percent: this.tolerance_percent,
    };
  }

  /**
   * Возврат денег плательщику отклоняемого платежа. Вызывает шлюз платежей,
   * когда кассир отклоняет входящий платёж ЮKassa. Повтор безопасен: ключ
   * идемпотентности — секрет платежа, повторный запрос второй возврат не создаёт.
   */
  public async refundPayment(hash: string): Promise<{ refunded: boolean; amount?: string }> {
    const payment = await this.payments.findByHash(hash);
    if (!payment) throw DomainError.notFound('YOOKASSA_PAYMENT_NOT_FOUND', { hash });
    const secret = payment.secret;
    if (!secret) throw DomainError.internal('YOOKASSA_PAYMENT_SECRET_MISSING', { hash });

    const providerId = providerPaymentId(payment.payment_details?.data) ?? (await this.findProviderPaymentBySecret(payment));
    if (!providerId) return { refunded: false };

    const checkout = this.checkout();
    const actual = await yookassaCall(() => checkout.getPayment(providerId));
    // Оплаты не было (форма не оплачена, платёж отменён) — возвращать нечего.
    if (actual.status !== 'succeeded') return { refunded: false };
    if ((actual.metadata as Record<string, unknown> | undefined)?.secret !== payment.secret) {
      throw DomainError.internal('YOOKASSA_REFUND_FOREIGN_PAYMENT', { hash });
    }

    const paid = Number(actual.amount.value);
    const already = Number(actual.refunded_amount?.value ?? 0);
    const amount = `${actual.amount.value} ${actual.amount.currency}`;
    if (already >= paid) return { refunded: true, amount };

    const refund = await yookassaCall(() => checkout.createRefund(
      {
        payment_id: providerId,
        amount: { value: (paid - already).toFixed(2), currency: actual.amount.currency },
        description: t('yookassa.refund.description', { hashPrefix: hash.slice(0, 8) }),
      },
      refundIdempotenceKey(secret)
    ));
    if (refund.status === 'canceled') throw DomainError.internal('YOOKASSA_REFUND_CANCELED', { hash });

    this.logger.info('Возврат ЮKassa оформлен', { source: 'refundPayment', id: payment.id, refund: refund.id, amount });
    return { refunded: true, amount };
  }

  private checkout(): YooCheckout {
    return new YooCheckout({
      shopId: this.extension.config.client,
      secretKey: this.extension.config.secret,
    });
  }

  /** Запрос к API ЮKassa, которого нет в библиотеке (список платежей). */
  private async api<T>(path: string): Promise<T> {
    const auth = Buffer.from(`${this.extension.config.client}:${this.extension.config.secret}`).toString('base64');
    const response = await fetch(`https://api.yookassa.ru/v3${path}`, { headers: { Authorization: `Basic ${auth}` } });
    if (!response.ok) throw DomainError.internal('YOOKASSA_API_FAILED', { path, status: response.status });
    return (await response.json()) as T;
  }

  /**
   * Платёж ЮKassa по секрету кооператива — для платежей, заведённых до того,
   * как номер платежа ЮKassa начал храниться у нас. Ищется в пределах суток
   * от создания.
   */
  private async findProviderPaymentBySecret(payment: { secret?: string; created_at: Date }): Promise<string | null> {
    const from = new Date(new Date(payment.created_at).getTime() - 60 * 60 * 1000).toISOString();
    const to = new Date(new Date(payment.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const list = await this.api<{ items?: Array<{ id: string; metadata?: { secret?: string } }> }>(
      `/payments?created_at.gte=${encodeURIComponent(from)}&created_at.lte=${encodeURIComponent(to)}&limit=100`
    );
    return list.items?.find((item) => item.metadata?.secret === payment.secret)?.id ?? null;
  }
}

/**
 * Ключ идемпотентности возврата. ЮKassa принимает ключ не длиннее 64 знаков,
 * а секрет платежа сам занимает 64 — ключ строится из его хэша. Один платёж —
 * один ключ: повторное отклонение второй возврат не создаёт.
 */
export function refundIdempotenceKey(secret: string): string {
  return `refund-${createHash('sha256').update(secret).digest('hex').slice(0, 40)}`;
}

/**
 * Вызов библиотеки ЮKassa с понятной ошибкой. Библиотека бросает ответ ЮKassa
 * объектом без `message` ({ code, description }), и до кассира доходило
 * «Internal Server Error» без причины.
 */
async function yookassaCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof DomainError) throw error;
    const e = (error ?? {}) as { description?: string; code?: string; message?: string };
    throw DomainError.badRequest('YOOKASSA_REQUEST_REFUSED', {
      description: e.description || e.message || String(e.code ?? 'unknown'),
    });
  }
}

/** Номер платежа ЮKassa из сохранённых реквизитов; у старых платежей там строка-токен. */
function providerPaymentId(data: unknown): string | null {
  if (data && typeof data === 'object' && typeof (data as { payment_id?: unknown }).payment_id === 'string') {
    return (data as { payment_id: string }).payment_id || null;
  }
  return null;
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
