import { Injectable } from '@nestjs/common';
import type { IPaymentProvider, IPaymentProviderRegistryPort } from '@coopenomics/innercoop';
import { ProviderDomainService } from '~/domain/gateway/provider-domain.service';

/**
 * Реализация `IPaymentProviderRegistryPort` для расширений-способов оплаты.
 *
 * Тонкая обёртка над реестром ядра: расширение кладёт себя туда при запуске,
 * расчётный контур достаёт по имени, когда пайщик выбрал этот способ.
 */
@Injectable()
export class PaymentProviderRegistryInnercoopAdapter implements IPaymentProviderRegistryPort {
  constructor(private readonly providerService: ProviderDomainService) {}

  registerProvider(name: string, provider: IPaymentProvider): void {
    this.providerService.registerProvider(name, provider);
  }

  getProvider(name: string): IPaymentProvider | undefined {
    return this.providerService.getProvider(name);
  }
}
