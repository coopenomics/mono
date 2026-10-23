import { Module } from '@nestjs/common';
import { UserDomainModule } from '~/domain/user/user-domain.module';
import { AuthV2InfrastructureModule } from '~/infrastructure/auth-v2/auth-v2-infrastructure.module';
import { NotificationCenterModule } from '~/application/notification-center/notification-center.module';
import { EmailVerificationService } from './email-verification.service';

/**
 * Подтверждение почты кодом — отдельный лёгкий модуль, а не часть `AuthModule`.
 *
 * Сервис нужен двоим: резолверу auth (запрос и проверка кода) и регистрации
 * (перенос отметки на созданного пайщика). Тянуть ради этого `AuthModule` в
 * `AccountModule` нельзя — он через `AuthV2Module` замыкается обратно на
 * аккаунты, и Nest на таком кольце не падает, а молча висит.
 */
@Module({
  imports: [UserDomainModule, AuthV2InfrastructureModule, NotificationCenterModule],
  providers: [EmailVerificationService],
  exports: [EmailVerificationService],
})
export class EmailVerificationModule {}
