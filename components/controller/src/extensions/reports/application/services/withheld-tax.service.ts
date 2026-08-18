import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SovietContract } from 'cooptypes';
import { platformSettings, rethrowChainError } from '@coopenomics/extension-kit';
import {
  getTaxTransferRequisites,
  type TaxTransferRequisites,
} from '@coopenomics/jurisdictions';
import {
  ORGANIZATION_PORT,
  PAYMENT_DESK_PORT,
  PaymentStatus,
  PaymentType,
  type IOrganizationPort,
  type IPaymentDeskPort,
  type InnerPayment,
  type InnerSystemOutgoingPaymentInput,
} from '@coopenomics/innercoop';
import {
  WITHHELD_TAX_BLOCKCHAIN_PORT,
  type WithheldTaxBlockchainPort,
} from '../../domain/ports/withheld-tax-blockchain.port';
import { ReportType, uvNdflPeriodOf } from '../../domain/enums/report-type.enum';
import { REPORTS_CALENDAR_REGISTRY } from '../../domain/services/reports-calendar-registry';
import { toTaxDateParts } from '../../domain/services/ndfl-reference';
import type {
  WithheldTaxPaymentDTO,
  WithheldTaxPaymentPageDTO,
  WithheldTaxStateDTO,
} from '../dto/withheld-tax.dto';

/**
 * Перечисление удержанного налога в бюджет (решение владельца 2026-08-13).
 *
 * Удерживая налог при выплате дохода физическому лицу, кооператив копит
 * обязательство перед бюджетом: деньги остаются на расчётном счёте, а долг
 * виден как остаток общекооперативного кошелька `w.sov.ndfl`. Гасится он не по
 * каждой выплате, а единым налоговым платежом — так налоги и платятся: одной
 * суммой на счёт налоговой, с последующим уведомлением о том, как её разнести.
 *
 * Раздел живёт на столе бухгалтера, а не в программе-источнике: удержания в
 * один кошелёк стекаются от любой программы, а распоряжается долгом
 * бухгалтерия. Программа-источник только считает удержание в момент выплаты.
 *
 * Отсюда три действия: показать, сколько удержано и сколько уже в пути к
 * кассиру; показать историю перечислений; отправить сумму на оплату. Больше
 * удержанного отправить нельзя — контракт это и проверяет, но отсекать надо
 * раньше, чтобы бухгалтер увидел причину, а не отказ цепи.
 */
@Injectable()
export class WithheldTaxService {
  private readonly logger = new Logger(WithheldTaxService.name);

  constructor(
    @Inject(WITHHELD_TAX_BLOCKCHAIN_PORT)
    private readonly chainPort: WithheldTaxBlockchainPort,
    @Inject(PAYMENT_DESK_PORT)
    private readonly paymentDesk: IPaymentDeskPort,
    @Inject(ORGANIZATION_PORT)
    private readonly orgRepo: IOrganizationPort
  ) {}

  /**
   * Реквизиты бюджета на сегодня для страны кооператива. Страна берётся из
   * профиля организации, а не подразумевается: платить налог одинаково во всех
   * странах нельзя, а справочник для неизвестной страны честно молчит.
   */
  private async loadTaxRequisites(coopname: string): Promise<TaxTransferRequisites | null> {
    let country: string | null = null;
    try {
      country = (await this.orgRepo.findByUsername(coopname))?.country ?? null;
    } catch (e) {
      this.logger.warn(
        `Не удалось определить страну кооператива ${coopname}: ` +
          `${e instanceof Error ? e.message : String(e)}`
      );
    }
    return getTaxTransferRequisites(country, new Date());
  }

  private formatAsset(amount: number): string {
    const { rootGovernSymbol, rootGovernPrecision } = platformSettings().blockchain;
    return `${amount.toFixed(rootGovernPrecision)} ${rootGovernSymbol}`;
  }

  private assetToNumber(asset: string | null | undefined): number {
    if (!asset) return 0;
    const parsed = Number.parseFloat(asset.split(' ')[0] ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * Сколько налога удержано, сколько уже отправлено кассиру и сколько можно
   * отправить сейчас.
   *
   * «В пути» считается по заявкам на цепи, а не по core-платежам: заявка живёт
   * ровно от отправки до подтверждения кассиром, и её сумма ещё сидит в
   * остатке кошелька — иначе бухгалтер отправил бы те же деньги дважды.
   */
  async getState(coopname: string): Promise<WithheldTaxStateDTO> {
    const [walletBalance, pending] = await Promise.all([
      this.chainPort.getWithheldTaxWalletBalance(coopname),
      this.chainPort.listPendingTaxRequests(coopname),
    ]);

    const withheld = this.assetToNumber(walletBalance);
    const inPayment = pending.reduce((sum, row) => sum + this.assetToNumber(row.amount), 0);

    return {
      withheld: this.formatAsset(withheld),
      in_payment: this.formatAsset(inPayment),
      available: this.formatAsset(Math.max(0, withheld - inPayment)),
    };
  }

  /**
   * История отправленных на оплату сумм — от новых к старым.
   *
   * Источник — реестр платежей кассирского стола, а не цепь: заявка на цепи
   * живёт только до подтверждения кассиром и после этого стирается, а
   * бухгалтеру нужна и оплаченная, и отклонённая.
   */
  async listPayments(
    coopname: string,
    page: number,
    limit: number
  ): Promise<WithheldTaxPaymentPageDTO> {
    const found = await this.paymentDesk.getPayments(
      { coopname, type: PaymentType.TAX },
      { page, limit, sortBy: 'created_at', sortOrder: 'DESC' }
    );

    return {
      items: found.items.map((payment) => this.toPaymentView(payment)),
      totalCount: found.totalCount,
      totalPages: found.totalPages,
      currentPage: found.currentPage,
    };
  }

  /**
   * Отправить удержанный налог на оплату: заявка появляется у кассира в
   * реестре исходящих платежей, он платит по реквизитам налоговой и
   * подтверждает — тогда обязательство закрывается.
   *
   * Платёж создаётся сразу видимым кассиру (PENDING): решение совета здесь не
   * требуется, перечисление удержанного налога — обязанность налогового
   * агента, а не распоряжение средствами кооператива.
   */
  async pay(coopname: string, amount: number): Promise<string> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Сумма платежа должна быть больше нуля');
    }

    const state = await this.getState(coopname);
    const available = this.assetToNumber(state.available);
    if (amount > available) {
      throw new BadRequestException(
        `Доступно к перечислению ${state.available}: перечислить можно не больше удержанного, ` +
          `а ${state.in_payment} уже отправлено кассиру и ждёт подтверждения`
      );
    }

    const asset = this.formatAsset(amount);
    const taxHash = createHash('sha256')
      .update(`${coopname}:tax:${randomBytes(16).toString('hex')}`)
      .digest('hex');

    // Core-платёж создаётся до отправки на цепь — кассиру нужна заявка, даже
    // если цепь ответит не сразу. Получателем платежа стоит сам кооператив:
    // деньги уходят в бюджет, пайщика-получателя здесь нет.
    const requisites = await this.loadTaxRequisites(coopname);
    try {
      await this.paymentDesk.createSystemOutgoingPayment({
        coopname,
        username: coopname,
        quantity: amount,
        symbol: platformSettings().blockchain.rootGovernSymbol,
        memo: requisites?.memo ?? 'Перечисление удержанного НДФЛ',
        type: PaymentType.TAX,
        status: PaymentStatus.PENDING,
        related_extension: 'reports',
        related_entity_id: taxHash,
        payment_hash: taxHash,
        ...this.budgetPaymentDetails(asset, requisites),
      });
    } catch (e: any) {
      throw new BadRequestException(
        `Не удалось зарегистрировать платёж в реестре: ${e.message}. Заявка не создана, повторите попытку.`
      );
    }

    try {
      await this.chainPort.createTaxRequest({
        coopname,
        tax_hash: taxHash,
        amount: asset,
        meta: JSON.stringify({ kind: 'ndfl', amount: asset }),
      } as SovietContract.Actions.Tax.CreateTax.ICreatetax);
    } catch (e) {
      // Заявка на цепь не встала — гасим core-платёж, иначе кассир заплатит
      // по заявке, которой на цепи нет, и подтверждение не найдёт запись.
      await this.cancelPayment(coopname, taxHash);
      rethrowChainError(e);
    }

    this.logger.log(`Налоговый платёж ${taxHash.slice(0, 8)}: отправлено на оплату ${asset}`);
    return asset;
  }

  /**
   * Реквизиты бюджета снимком в деталях платежа. Платёжного метода у такой
   * выплаты нет — реквизиты налоговой не принадлежат никому из пайщиков, а
   * кассиру они нужны в карточке платежа, а не в его памяти. Для страны, чьи
   * реквизиты системе неизвестны, деталей нет: заявка всё равно создаётся, и
   * кассир заполняет платёжку сам, как делал раньше.
   */
  private budgetPaymentDetails(
    asset: string,
    requisites: TaxTransferRequisites | null
  ): Pick<InnerSystemOutgoingPaymentInput, 'payment_details'> | Record<string, never> {
    if (!requisites) return {};
    return {
      payment_details: {
        data: {
          recipient_name: requisites.recipientName,
          requisite_rows: requisites.rows,
        },
        amount_plus_fee: asset,
        amount_without_fee: asset,
        fee_amount: '0',
        fee_percent: 0,
        fact_fee_percent: 0,
        tolerance_percent: 0,
      },
    };
  }

  /** Отменить core-платёж, если заявка не дошла до цепи. */
  private async cancelPayment(coopname: string, taxHash: string): Promise<void> {
    try {
      const found = await this.paymentDesk.getPayments(
        { coopname, hash: taxHash },
        { page: 1, limit: 1, sortOrder: 'DESC' }
      );
      const payment = found.items[0];
      if (payment?.id) {
        await this.paymentDesk.setPaymentStatus({
          id: payment.id,
          status: PaymentStatus.CANCELLED,
          message: 'Заявку на перечисление налога не удалось зарегистрировать',
        });
      }
    } catch (e: any) {
      // Гашение — лучшее усилие: исходная ошибка цепи важнее и уже летит наверх.
      this.logger.warn(`Не удалось отменить платёж ${taxHash.slice(0, 8)}: ${e.message}`);
    }
  }

  /**
   * Расчётный период платежа — по дате отправки на оплату, а не по дате
   * подтверждения кассиром: обязательство возникает в момент, когда бухгалтер
   * распорядился суммой, и в этот же период попадает уведомление. Дата берётся
   * по налоговому поясу — платёж, отправленный поздним вечером 22-го, по UTC
   * может выглядеть как 23-е и уехать в следующий период.
   */
  private toPaymentView(payment: InnerPayment): WithheldTaxPaymentDTO {
    const data = (payment.payment_details?.data ?? {}) as {
      recipient_name?: string;
      requisite_rows?: { label: string; value: string }[];
    };
    const parts = toTaxDateParts(payment.created_at);
    const period = uvNdflPeriodOf(parts.month, parts.day > 22);

    return {
      hash: payment.hash,
      amount: this.formatAsset(payment.quantity),
      symbol: payment.symbol,
      memo: payment.memo ?? '',
      status: payment.status,
      ...(payment.message ? { message: payment.message } : {}),
      ...(data.recipient_name ? { recipient_name: data.recipient_name } : {}),
      ...(data.requisite_rows ? { requisite_rows: data.requisite_rows } : {}),
      created_at: payment.created_at,
      ...(payment.completed_at ? { completed_at: payment.completed_at } : {}),
      report_year: parts.year,
      report_period: period,
      report_period_label: periodLabel(period),
    };
  }
}

/**
 * Название расчётного периода берётся из календаря отчётности — того же, где
 * бухгалтер видит сроки подачи уведомлений. Две подписи одного периода
 * разошлись бы, и совпадение платежа с формой перестало бы читаться.
 */
function periodLabel(period: number): string {
  const form = REPORTS_CALENDAR_REGISTRY.find((entry) => entry.reportType === ReportType.UV_NDFL);
  const entry = form?.periods.find((p) => p.periodCode === period);
  return entry?.label ?? String(period);
}
