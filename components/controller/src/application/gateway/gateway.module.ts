import { Module, forwardRef } from '@nestjs/common';
import { GatewayResolver } from './resolvers/gateway.resolver';
import { GatewayService } from './services/gateway.service';
import { PaymentNotificationService } from './services/payment-notification.service';
import { WithdrawAuthorizationListener } from './services/withdraw-authorization.listener';
import { InvestmentAuthorizationListener } from './services/investment-authorization.listener';
import { HubInfrastructureModule } from '~/infrastructure/hub/hub-infrastructure.module';
import { PaymentController } from './controllers/payment.controller';
import { GatewayInteractor } from './interactors/gateway.interactor';
import { GatewayNotificationHandler } from './handlers/gateway-notification.handler';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { SystemModule } from '~/application/system/system.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { RedisModule } from '~/infrastructure/redis/redis.module';

@Module({
  imports: [
    forwardRef(() => GatewayDomainModule),
    forwardRef(() => GatewayInfrastructureModule),
    UserInfrastructureModule,
    UserDomainModule,
    AccountInfrastructureModule,
    AccountInfrastructureModule,
    SystemModule,
    RedisModule,
    HubInfrastructureModule,
  ],
  controllers: [PaymentController],
  providers: [
    GatewayResolver,
    GatewayService,
    PaymentNotificationService,
    GatewayInteractor,
    GatewayNotificationHandler,
    WithdrawAuthorizationListener,
    InvestmentAuthorizationListener,
  ],
  exports: [GatewayService, PaymentNotificationService, GatewayInteractor],
})
export class GatewayModule {}
