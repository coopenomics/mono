import { Module, forwardRef } from '@nestjs/common';
import { GatewayInteractorAdapter } from './gateway-interactor.adapter';
import { ProviderAdapter } from './provider.adapter';
import { GatewayModule } from '~/application/gateway/gateway.module';
import { GATEWAY_INTERACTOR_PORT } from '~/domain/wallet/ports/gateway-interactor.port';
import { ProviderDomainService } from '~/domain/gateway/provider-domain.service';
import { PROVIDER_PORT } from '~/domain/gateway/ports/provider.port';

@Module({
  imports: [
    // Обратная сторона цикла gateway.module ↔ gateway-infrastructure.module:
    // провайдер платежей вызывает сценарий приложения, сценарий обращается к
    // провайдеру. Причина та же, см. комментарий в application/gateway.
    forwardRef(() => GatewayModule),
  ],
  providers: [
    GatewayInteractorAdapter,
    ProviderDomainService,
    ProviderAdapter,
    {
      provide: GATEWAY_INTERACTOR_PORT,
      useClass: GatewayInteractorAdapter,
    },
    {
      provide: PROVIDER_PORT,
      useClass: ProviderAdapter,
    },
  ],
  // `ProviderDomainService` экспортирован для `PaymentProviderRegistryInnercoopAdapter`:
  // реестр способов оплаты раздаётся расширениям через порт, а привязка порта
  // живёт в `InnercoopBridgeModule`, за пределами этого модуля.
  exports: [GATEWAY_INTERACTOR_PORT, PROVIDER_PORT, ProviderDomainService],
})
export class GatewayInfrastructureModule {}
