import { Injectable, Logger } from '@nestjs/common';
import type { IProviderAppsPort, InnerAppOffer, InnerAppSubscribeOutcome } from '@coopenomics/innercoop';
import { DomainError } from '@coopenomics/extension-kit';
import { ProviderService } from '~/application/provider/services/provider.service';

/**
 * Реализация `IProviderAppsPort` (487-34): подписка на приложение каталога
 * оформляется у провайдера server-secret каналом узла оператора. Узел без
 * провайдера отвечает `unavailable`: подписку оформляют на столе подключения
 * у оператора, там же она попадает в общий счёт.
 */
@Injectable()
export class ProviderAppsInnercoopAdapter implements IProviderAppsPort {
  private readonly logger = new Logger(ProviderAppsInnercoopAdapter.name);

  constructor(private readonly providerService: ProviderService) {}

  async listOffers(coopname: string): Promise<InnerAppOffer[] | null> {
    if (!this.providerService.isProviderAvailable()) return null;
    try {
      return await this.providerService.listAppOffers(coopname);
    }
    catch (error: any) {
      // Витрина без цены лучше, чем витрина, упавшая из-за провайдера.
      this.logger.warn(`Цены приложений для ${coopname} не получены: ${error?.message ?? error}`);
      return null;
    }
  }

  async subscribe(coopname: string, packageId: string): Promise<InnerAppSubscribeOutcome> {
    if (!this.providerService.isProviderAvailable()) return { status: 'unavailable' };
    try {
      const { subscription, created } = await this.providerService.subscribeApp(coopname, packageId);
      return { status: 'subscribed', created, subscription };
    }
    catch (error: any) {
      const message = error?.message ?? String(error);
      if (error instanceof DomainError && error.code === 'PROVIDER_APP_NOT_OFFERED') {
        return { status: 'notOffered', error: message };
      }
      this.logger.warn(`Подписка ${coopname} на ${packageId} не оформлена: ${message}`);
      return { status: 'failed', error: message };
    }
  }
}
