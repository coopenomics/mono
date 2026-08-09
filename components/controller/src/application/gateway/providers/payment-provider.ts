import { BaseExtensionModule } from '@coopenomics/extension-kit';
import type { PaymentDetailsDomainInterface } from '~/domain/gateway/interfaces/payment-domain.interface';
import type { PaymentProviderPort } from '~/domain/gateway/ports/payment-provider.port';

/**
 * Абстрактный базовый класс для платежных провайдеров
 * Наследуется от BaseExtensionModule и реализует интерфейс PaymentProviderPort из domain
 */
export abstract class PaymentProvider extends BaseExtensionModule implements PaymentProviderPort {
  public abstract tolerance_percent: number;
  public abstract fee_percent: number;
  public abstract createPayment(hash: string): Promise<PaymentDetailsDomainInterface>;
}
