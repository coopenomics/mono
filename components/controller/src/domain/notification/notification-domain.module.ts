import { Global, Module } from '@nestjs/common';
import { NotificationDomainService, NOTIFICATION_DOMAIN_SERVICE } from './services/notification-domain.service';
import { InfrastructureModule } from '~/infrastructure/infrastructure.module';

@Global()
@Module({
  imports: [InfrastructureModule],
  providers: [
    NotificationDomainService,
    {
      provide: NOTIFICATION_DOMAIN_SERVICE,
      useExisting: NotificationDomainService,
    },
  ],
  exports: [NotificationDomainService, NOTIFICATION_DOMAIN_SERVICE],
})
export class NotificationDomainModule {}
