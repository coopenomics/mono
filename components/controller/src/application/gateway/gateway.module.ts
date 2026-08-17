import { Module } from '@nestjs/common';
import { GatewayResolver } from './resolvers/gateway.resolver';
import { PaymentFilesResolver } from './resolvers/payment-files.resolver';
import { GatewayService } from './services/gateway.service';
import { PaymentFilesService } from './services/payment-files.service';
import { PaymentNotificationService } from './services/payment-notification.service';
import { WithdrawAuthorizationListener } from './services/withdraw-authorization.listener';
import { PaymentController } from './controllers/payment.controller';
import { GatewayInteractor } from './interactors/gateway.interactor';
import { GatewayNotificationHandler } from './handlers/gateway-notification.handler';
import { GatewayExpiryCronService } from './services/gateway-expiry-cron.service';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { SystemModule } from '~/application/system/system.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { RedisModule } from '~/infrastructure/redis/redis.module';
import { bucketProvidersFor } from '@coopenomics/extension-kit';
import { FILE_STORAGE_PORT } from '@coopenomics/innercoop';
import { GATEWAY_INTERACTOR_PORT } from '~/domain/wallet/ports/gateway-interactor.port';

@Module({
  imports: [
    // Реестр платёжных провайдеров (PROVIDER_PORT). Обратного ребра нет:
    // инфраструктура шлюза про приложение не знает.
    GatewayInfrastructureModule,
    UserInfrastructureModule,
    UserDomainModule,
    AccountInfrastructureModule,
    SystemModule,
    RedisModule,
  ],
  controllers: [PaymentController],
  providers: [
    // Чек об оплате (gateway:files) — ядровый механизм, бакет по @UseBucket.
    ...bucketProvidersFor(FILE_STORAGE_PORT, [PaymentFilesService]),
    GatewayResolver,
    PaymentFilesResolver,
    GatewayService,
    PaymentFilesService,
    PaymentNotificationService,
    GatewayInteractor,
    // Порт объявлен доменом кошелька, реализует его сам интерактор: сценарии
    // платежей живут здесь, и промежуточный адаптер только пробрасывал вызовы.
    { provide: GATEWAY_INTERACTOR_PORT, useExisting: GatewayInteractor },
    GatewayNotificationHandler,
    WithdrawAuthorizationListener,
    GatewayExpiryCronService,
  ],
  exports: [
    GatewayService,
    PaymentNotificationService,
    GatewayInteractor,
    GATEWAY_INTERACTOR_PORT,
    PaymentFilesService,
  ],
})
export class GatewayModule {}
