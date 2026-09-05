import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { RegisteredAccountDTO } from '~/application/account/dto/registered-account.dto';
import { LoginInputDTO } from '../dto/login-input.dto';
import { AuthService } from '../services/auth.service';
import { RefreshInputDTO } from '../dto/refresh-input.dto';
import { LogoutInputDTO } from '../dto/logout-input.dto';
import { StartResetKeyInputDTO } from '../dto/start-reset-key-input.dto';
import { ResetKeyInputDTO } from '../dto/reset-key-input.dto';
import { VerifyEmailInputDTO } from '../dto/verify-email-input.dto';
import {
  ConfirmEmailVerificationInputDTO,
  EmailVerificationRequestDTO,
  RequestEmailVerificationInputDTO,
} from '../dto/email-verification.dto';
import { ClientIp } from '../decorators/request-meta.decorator';
import { EmailVerificationService } from '../email-verification/email-verification.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService
  ) {}

  @Mutation(() => RegisteredAccountDTO, {
    name: 'login',
    description: 'Войти в систему с помощью цифровой подписи и получить JWT-токены доступа',
  })
  async login(
    @Args('data', { type: () => LoginInputDTO })
    data: LoginInputDTO
  ): Promise<RegisteredAccountDTO> {
    return this.authService.login(data);
  }

  @Mutation(() => RegisteredAccountDTO, {
    name: 'refresh',
    description: 'Обновить токен доступа аккаунта',
  })
  async refresh(
    @Args('data', { type: () => RefreshInputDTO })
    data: RefreshInputDTO
  ): Promise<RegisteredAccountDTO> {
    return await this.authService.refresh(data);
  }

  @Mutation(() => Boolean, {
    name: 'logout',
    description: 'Выйти из системы и заблокировать JWT-токены',
  })
  async logout(
    @Args('data', { type: () => LogoutInputDTO })
    data: LogoutInputDTO
  ): Promise<boolean> {
    await this.authService.logout(data);
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'startResetKey',
    description: 'Выслать токен для замены приватного ключа аккаунта на электронную почту',
  })
  async startResetKey(
    @Args('data', { type: () => StartResetKeyInputDTO })
    data: StartResetKeyInputDTO
  ): Promise<boolean> {
    await this.authService.startResetKey(data);
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'resetKey',
    description: 'Заменить приватный ключ аккаунта',
  })
  async resetKey(
    @Args('data', { type: () => ResetKeyInputDTO })
    data: ResetKeyInputDTO
  ): Promise<boolean> {
    await this.authService.resetKey(data);
    return true;
  }

  @Mutation(() => EmailVerificationRequestDTO, {
    name: 'requestEmailVerification',
    description: 'Выслать код подтверждения на электронную почту',
  })
  async requestEmailVerification(
    @Args('data', { type: () => RequestEmailVerificationInputDTO })
    data: RequestEmailVerificationInputDTO,
    @ClientIp() ip: string | null
  ): Promise<EmailVerificationRequestDTO> {
    // Без авторизации: код спрашивается на первом шаге регистрации, когда
    // учётной записи ещё нет. Ответ одинаков для знакомых и незнакомых адресов —
    // иначе мутация стала бы проверялкой «кто состоит в кооперативе».
    return this.emailVerification.request(data.email, ip);
  }

  @Mutation(() => Boolean, {
    name: 'confirmEmailVerification',
    description: 'Подтвердить электронную почту кодом из письма',
  })
  async confirmEmailVerification(
    @Args('data', { type: () => ConfirmEmailVerificationInputDTO })
    data: ConfirmEmailVerificationInputDTO
  ): Promise<boolean> {
    return this.emailVerification.confirm(data.email, data.code);
  }

  @Mutation(() => Boolean, {
    name: 'verifyEmail',
    description: 'Подтвердить email адрес пользователя',
  })
  async verifyEmail(
    @Args('data', { type: () => VerifyEmailInputDTO })
    data: VerifyEmailInputDTO
  ): Promise<boolean> {
    await this.authService.verifyEmail(data.token);
    return true;
  }
}
