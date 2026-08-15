import { Module } from '@nestjs/common';
import { ProviderAdapter } from './provider.adapter';
import { ProviderDomainService } from '~/domain/gateway/provider-domain.service';
import { PROVIDER_PORT } from '~/domain/gateway/ports/provider.port';

/**
 * Инфраструктура шлюза: реестр платёжных провайдеров.
 *
 * Модуль намеренно не знает про `application/gateway`. Раньше знал — здесь
 * лежал адаптер, пробрасывавший десять методов в `GatewayInteractor`, и ради
 * него инфраструктура импортировала приложение, а приложение импортировало
 * инфраструктуру. Теперь порт сценариев платежей раздаёт сам `GatewayModule`,
 * которому эти сценарии и принадлежат.
 */
@Module({
  providers: [
    ProviderDomainService,
    ProviderAdapter,
    {
      provide: PROVIDER_PORT,
      useClass: ProviderAdapter,
    },
  ],
  // `ProviderDomainService` экспортирован для `PaymentProviderRegistryInnercoopAdapter`:
  // реестр способов оплаты раздаётся расширениям через порт, а привязка порта
  // живёт в `InnercoopBridgeModule`, за пределами этого модуля.
  exports: [PROVIDER_PORT, ProviderDomainService],
})
export class GatewayInfrastructureModule {}
