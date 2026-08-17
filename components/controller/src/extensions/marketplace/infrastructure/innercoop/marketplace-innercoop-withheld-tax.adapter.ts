import { Injectable } from '@nestjs/common';
import type {
  IWithheldTaxPort,
  InnerWithheldTaxPage,
  InnerWithheldTaxPageRequest,
  InnerWithheldTaxState,
} from '@coopenomics/innercoop';
import { MarketplaceTaxService } from '../../application/services/marketplace-tax.service';

/**
 * Реализация `IWithheldTaxPort` для стола бухгалтера.
 *
 * Удержания заводит Стол заказов — он единственный, кто сегодня выплачивает
 * доход физлицу (материальная помощь доверенным) и потому обязан удержать
 * налог. Перечисляет удержанное бухгалтерия, и её столу нужны ровно три вещи:
 * сколько должны бюджету, что уже отправлено кассиру и возможность отправить
 * остаток. Адаптер тонкий — вся логика в `MarketplaceTaxService`.
 */
@Injectable()
export class MarketplaceInnercoopWithheldTaxAdapter implements IWithheldTaxPort {
  constructor(private readonly taxService: MarketplaceTaxService) {}

  async getState(coopname: string): Promise<InnerWithheldTaxState> {
    return this.taxService.getTaxState(coopname);
  }

  async listPayments(
    coopname: string,
    page: InnerWithheldTaxPageRequest
  ): Promise<InnerWithheldTaxPage> {
    return this.taxService.listTaxPayments(coopname, page);
  }

  async createPayment(coopname: string, amount: number): Promise<string> {
    return this.taxService.createTaxPayment(coopname, amount);
  }
}
