import { Module } from '@nestjs/common';
import { AccountModule } from '~/application/account/account.module';
import { DesktopModule } from '~/application/desktop/desktop.module';
import { SsrContextController } from './ssr-context.controller';
import { SsrContextService } from './ssr-context.service';

/**
 * Отдельный модуль, а не часть AuthV2Module: тому нужны аккаунт и стол, а
 * AccountModule через инфраструктуру auth-v2 замыкается обратно — цикл.
 * Репозитории токенов и пользователей приходят из глобального TypeORM-модуля.
 */
@Module({
  imports: [AccountModule, DesktopModule],
  controllers: [SsrContextController],
  providers: [SsrContextService],
})
export class SsrContextModule {}
