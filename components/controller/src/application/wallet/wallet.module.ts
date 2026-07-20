import { Module } from '@nestjs/common';
import { WalletResolver } from './resolvers/wallet.resolver';
import { WalletService } from './services/wallet.service';
import { WalletInteractor } from './interactors/wallet.interactor';
import { WalletNotificationService } from './services/wallet-notification.service';
import { ProgramWalletSyncService } from './services/program-wallet-sync.service';
import { ProgramWalletInitService } from './services/program-wallet-init.service';
import { GatewayDomainModule } from '~/domain/gateway/gateway-domain.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { AccountInfrastructureModule } from '~/infrastructure/account/account-infrastructure.module';
import { GatewayInfrastructureModule } from '~/infrastructure/gateway/gateway-infrastructure.module';
import { UserInfrastructureModule } from '~/infrastructure/user/user-infrastructure.module';
import { WalletDomainAdapter } from '~/infrastructure/wallet/adapters/wallet-domain.adapter';
import { WALLET_DOMAIN_PORT } from '~/domain/wallet/ports/wallet-domain.port';

/**
 * Модуль wallet для управления выводом средств, депозитными платежами, генерацией документов и программными кошельками
 */
@Module({
  imports: [
    GatewayDomainModule,
    GatewayInfrastructureModule,
    UserInfrastructureModule,
    UserDomainModule,
    AccountInfrastructureModule,
  ],
  providers: [
    WalletResolver,
    WalletService,
    WalletInteractor,
    WalletNotificationService,
    ProgramWalletSyncService,
    ProgramWalletInitService,
    {
      provide: WALLET_DOMAIN_PORT,
      useClass: WalletDomainAdapter,
    },
  ],
  exports: [WalletService, WalletInteractor, WALLET_DOMAIN_PORT],
})
export class WalletModule {}
