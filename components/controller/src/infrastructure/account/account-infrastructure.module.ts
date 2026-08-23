import { Module } from '@nestjs/common';
import { AccountAdapter } from './account.adapter';
import { AccountDataAdapter } from './account-data.adapter';
import { ACCOUNT_DOMAIN_PORT } from '~/domain/account/ports/account-domain.port';
import { ACCOUNT_DATA_PORT } from '~/domain/account/ports/account-data.port';
import { AccountModule } from '~/application/account/account.module';

@Module({
  imports: [AccountModule],
  providers: [
    AccountAdapter,
    AccountDataAdapter,
    {
      provide: ACCOUNT_DOMAIN_PORT,
      useClass: AccountAdapter,
    },
    {
      provide: ACCOUNT_DATA_PORT,
      useClass: AccountDataAdapter,
    },
  ],
  exports: [AccountAdapter, AccountDataAdapter, ACCOUNT_DOMAIN_PORT, ACCOUNT_DATA_PORT],
})
export class AccountInfrastructureModule {}
