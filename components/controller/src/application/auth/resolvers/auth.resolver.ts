import { Args, Mutation, Resolver, Context } from '@nestjs/graphql';
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
import type { Request, Response } from 'express';
import { clearSessionCookie, setSessionCookie } from '~/application/auth-v2/session-cookie/session-cookie';

/** HTTP-контекст GraphQL: { req, res } (см. graphql.module). У ws-подписок res нет. */
type HttpGqlContext = { req?: Request; res?: Response };

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
    data: LoginInputDTO,
    @Context() ctx: HttpGqlContext
  ): Promise<RegisteredAccountDTO> {
    const result = await this.authService.login(data);
    // Cookie сессии для серверного рендера — легаси-вход по ключу наравне с CoopID.
    if (ctx?.req && ctx?.res) setSessionCookie(ctx.req, ctx.res, result.tokens?.access?.token);
    return result;
  }

  @Mutation(() => RegisteredAccountDTO, {
    name: 'refresh',
    description: 'Обновить токен доступа аккаунта',
  })
  async refresh(
    @Args('data', { type: () => RefreshInputDTO })
    data: RefreshInputDTO,
    @Context() ctx: HttpGqlContext
  ): Promise<RegisteredAccountDTO> {
    const result = await this.authService.refresh(data);
    if (ctx?.req && ctx?.res) setSessionCookie(ctx.req, ctx.res, result.tokens?.access?.token);
    return result;
  }

  @Mutation(() => Boolean, {
    name: 'logout',
    description: 'Выйти из системы и заблокировать JWT-токены',
  })
  async logout(
    @Args('data', { type: () => LogoutInputDTO })
    data: LogoutInputDTO,
    @Context() ctx: HttpGqlContext
  ): Promise<boolean> {
    await this.authService.logout(data);
    if (ctx?.req && ctx?.res) clearSessionCookie(ctx.req, ctx.res);
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
