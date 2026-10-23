import { Global, Module } from '@nestjs/common';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { UserDomainService, USER_DOMAIN_SERVICE } from './services/user-domain.service';
import { UserCertificateDomainService, USER_CERTIFICATE_DOMAIN_SERVICE } from './services/user-certificate-domain.service';

/**
 * Доменный модуль пользователей
 * Предоставляет доменные сервисы для работы с пользователями и сертификатами
 */
@Global()
@Module({
  // Порт CoopID (AUTHENTIK_ADMIN_PORT): почта пайщика ведётся в двух местах.
  imports: [AuthV2InfrastructureModule],
  providers: [
    UserDomainService,
    {
      provide: USER_DOMAIN_SERVICE,
      useExisting: UserDomainService,
    },
    UserCertificateDomainService,
    {
      provide: USER_CERTIFICATE_DOMAIN_SERVICE,
      useExisting: UserCertificateDomainService,
    },
  ],
  exports: [UserDomainService, USER_DOMAIN_SERVICE, UserCertificateDomainService, USER_CERTIFICATE_DOMAIN_SERVICE],
})
export class UserDomainModule {}
