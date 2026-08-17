import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import {
  WITHHELD_TAX_PORT,
  type IWithheldTaxPort,
  type InnerWithheldTaxPayment,
  type PaymentStatus,
} from '@coopenomics/innercoop';
import { ReportType, uvNdflPeriodOf } from '../../domain/enums/report-type.enum';
import { REPORTS_CALENDAR_REGISTRY } from '../../domain/services/reports-calendar-registry';
import { toTaxDateParts } from '../../domain/services/ndfl-reference';
import type {
  WithheldTaxPaymentDTO,
  WithheldTaxPaymentPageDTO,
  WithheldTaxStateDTO,
} from '../dto/withheld-tax.dto';

/** Пустое состояние: удержаний нет, значит и платить нечего. */
const EMPTY_STATE: WithheldTaxStateDTO = {
  withheld: '0.0000 RUB',
  in_payment: '0.0000 RUB',
  available: '0.0000 RUB',
};

/**
 * Перечисление удержанного налога глазами бухгалтера.
 *
 * Удержания ведёт то расширение, которое выплачивает доход физлицу, — сегодня
 * это Стол заказов с материальной помощью доверенным. Стол бухгалтера видит
 * их через порт контура и добавляет то, что знает сам: расчётный период, в
 * который платёж попадает, — тот же, за который подаётся уведомление об
 * исчисленных суммах, поэтому бухгалтер сразу видит связь платежа с формой.
 *
 * Без источника удержаний порт не привязан. Это не ошибка: кооператив мог не
 * подключать Стол заказов, и тогда удерживать было нечего — состояние пустое,
 * история пуста, а попытка заплатить отклоняется с внятной причиной.
 */
@Injectable()
export class WithheldTaxService {
  constructor(
    @Optional()
    @Inject(WITHHELD_TAX_PORT)
    private readonly taxPort?: IWithheldTaxPort
  ) {}

  async getState(coopname: string): Promise<WithheldTaxStateDTO> {
    if (!this.taxPort) return EMPTY_STATE;
    return this.taxPort.getState(coopname);
  }

  async listPayments(
    coopname: string,
    page: number,
    limit: number
  ): Promise<WithheldTaxPaymentPageDTO> {
    if (!this.taxPort) {
      return { items: [], totalCount: 0, totalPages: 0, currentPage: page };
    }

    const result = await this.taxPort.listPayments(coopname, {
      page,
      limit,
      sortOrder: 'DESC',
    });

    return {
      items: result.items.map((payment) => this.withReportPeriod(payment)),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  }

  async pay(coopname: string, amount: number): Promise<string> {
    if (!this.taxPort) {
      throw new ServiceUnavailableException(
        'Удержаний налога в кооперативе нет: перечислять нечего'
      );
    }
    return this.taxPort.createPayment(coopname, amount);
  }

  /**
   * Расчётный период платежа — по дате отправки на оплату, а не по дате
   * подтверждения кассиром: обязательство возникает в момент, когда бухгалтер
   * распорядился суммой, и в этот же период попадает уведомление. Дата берётся
   * по налоговому поясу — платёж, отправленный поздним вечером 22-го, по UTC
   * может выглядеть как 23-е и уехать в следующий период.
   */
  private withReportPeriod(payment: InnerWithheldTaxPayment): WithheldTaxPaymentDTO {
    const parts = toTaxDateParts(payment.created_at);
    const period = uvNdflPeriodOf(parts.month, parts.day > 22);

    return {
      ...payment,
      status: payment.status as PaymentStatus,
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
