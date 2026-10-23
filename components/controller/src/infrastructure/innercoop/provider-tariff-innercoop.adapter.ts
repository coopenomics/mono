import { Injectable, Logger } from '@nestjs/common';
import type { IProviderTariffPort, InnerProviderTariff } from '@coopenomics/innercoop';
import { ProviderService } from '~/application/provider/services/provider.service';

/**
 * Реализация `IProviderTariffPort`: тариф кооператива берётся из каталога
 * провайдера (`GET /v1/subscription-types?coopname=`), где провайдер уже
 * посчитал D на текущий календарный месяц. Любой отказ — `null`: расширение
 * powerup без тарифа арендует по своей настройке, а не падает.
 */
@Injectable()
export class ProviderTariffInnercoopAdapter implements IProviderTariffPort {
  private readonly logger = new Logger(ProviderTariffInnercoopAdapter.name);

  constructor(private readonly providerService: ProviderService) {}

  async currentTariff(coopname: string): Promise<InnerProviderTariff | null> {
    if (!this.providerService.isProviderAvailable()) return null;
    try {
      const catalog = await this.providerService.getConnectionCatalog(coopname);
      const current = catalog.current_tariff as (InnerProviderTariff & Record<string, unknown>) | null;
      if (!current || !Number.isFinite(Number(current.daily_axon))) return null;
      return {
        code: String(current.code),
        docflow_axon: Number(current.docflow_axon ?? 0),
        daily_axon: Number(current.daily_axon),
        trial_days: Number(current.trial_days ?? 0),
      };
    } catch (error: any) {
      this.logger.warn(`Тариф ${coopname} у провайдера не получен: ${error?.message ?? error}`);
      return null;
    }
  }
}
