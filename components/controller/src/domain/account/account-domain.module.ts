// domain/account/account-domain.module.ts

import { Global, Module } from '@nestjs/common';
import { AccountDomainService, ACCOUNT_DOMAIN_SERVICE } from './services/account-domain.service';
import {
  NotificationSubscriberSyncService,
  NOTIFICATION_SUBSCRIBER_SYNC_SERVICE,
} from './services/notification-subscriber-sync.service';
import { AccountRoleEventService } from './services/account-role-event.service';
import { ParticipantStatusSyncService } from './services/participant-status-sync.service';
import { TokenApplicationModule } from '~/application/token/token-application.module';
import { UserDomainModule } from '~/domain/user/user-domain.module';

@Global()
@Module({
  imports: [TokenApplicationModule, UserDomainModule],
  providers: [
    AccountDomainService,
    NotificationSubscriberSyncService,
    AccountRoleEventService,
    ParticipantStatusSyncService,
    {
      provide: ACCOUNT_DOMAIN_SERVICE,
      useExisting: AccountDomainService,
    },
    {
      provide: NOTIFICATION_SUBSCRIBER_SYNC_SERVICE,
      useExisting: NotificationSubscriberSyncService,
    },
  ],
  exports: [
    AccountDomainService,
    NotificationSubscriberSyncService,
    AccountRoleEventService,
    ParticipantStatusSyncService,
    ACCOUNT_DOMAIN_SERVICE,
    NOTIFICATION_SUBSCRIBER_SYNC_SERVICE,
  ],
})
export class AccountDomainModule {}
