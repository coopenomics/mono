import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import { ClientIp, RefreshTokenHeader } from '~/application/auth/decorators/request-meta.decorator';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';
import { SessionsService } from '../sessions/sessions.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { RecoveryStrategyService } from '../recovery/recovery-strategy.service';
import { SecurityIncidentService } from '../security/security-incident.service';
import { LoginFactorsService } from '../login-2fa/login-factors.service';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import {
  AccountSessionDTO,
  LoginFactorsDTO,
  ParticipantLoginSecurityDTO,
  ReportNotMeInputDTO,
  ResetParticipantTwoFactorInputDTO,
  RevokeSessionInputDTO,
  RevokedSessionsResultDTO,
  SetLoginFactorsInputDTO,
  SetRecoveryStrategyInputDTO,
  TwoFactorCodeInputDTO,
  TwoFactorEnrollmentDTO,
} from './dto/account-security.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role?: string;
  /** Сессия, которой выдан access-токен (claim `sid`); null у токенов старого выпуска. */
  session_id?: string | null;
}

/**
 * GraphQL-фасад самообслуживания безопасности аккаунта (Фаза 2 миграции REST→GraphQL/SDK).
 * Заменяет REST-контроллеры `coop/sessions`, `coop/2fa`, `coop/recovery/strategy` и
 * JWT-метод `coop/security/not-me` — фронт ходит через @coopenomics/sdk (Zeus), нового
 * способа взаимодействия с бэкендом наружу не появляется.
 *
 * Все операции — для текущего залогиненного пайщика (subject = `user.id`) под
 * `GqlJwtAuthGuard`. IP и refresh-токен текущей сессии — транспорт, берутся из
 * request-meta декораторов, не из GraphQL-переменных.
 */
@Resolver()
export class AccountSecurityResolver {
  constructor(
    private readonly sessions: SessionsService,
    private readonly twoFactor: TwoFactorService,
    private readonly recoveryStrategy: RecoveryStrategyService,
    private readonly incidents: SecurityIncidentService,
    private readonly loginFactors: LoginFactorsService,
    @Inject(USER_DOMAIN_SERVICE) private readonly users: UserDomainService,
  ) {}

  @Query(() => [AccountSessionDTO], {
    name: 'getSessions',
    description: 'Активные сессии текущего пайщика (текущая помечается current)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getSessions(
    @CurrentUser() user: ICurrentUser,
    @RefreshTokenHeader() currentRefreshToken: string | null,
  ): Promise<AccountSessionDTO[]> {
    const sessions = await this.sessions.list(user.id, currentRefreshToken, user.session_id);
    return sessions.map((s) => ({
      id: s.id,
      device: s.device,
      ip: s.ip,
      created_at: s.createdAt,
      last_seen_at: s.lastSeenAt,
      current: s.current,
    }));
  }

  @Query(() => RecoveryStrategy, {
    name: 'getRecoveryStrategy',
    description: 'Текущая стратегия восстановления доступа пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getRecoveryStrategy(@CurrentUser() user: ICurrentUser): Promise<RecoveryStrategy> {
    return this.recoveryStrategy.getStrategy(user.id);
  }

  @Mutation(() => Boolean, {
    name: 'revokeSession',
    description: 'Завершить конкретную сессию пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async revokeSession(
    @Args('data', { type: () => RevokeSessionInputDTO }) data: RevokeSessionInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    await this.sessions.revoke(user.id, data.session_id, ip);
    return true;
  }

  @Mutation(() => RevokedSessionsResultDTO, {
    name: 'revokeAllSessions',
    description: 'Завершить все сессии пайщика, кроме текущей',
  })
  @UseGuards(GqlJwtAuthGuard)
  async revokeAllSessions(
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<RevokedSessionsResultDTO> {
    return this.sessions.revokeAll(user.id, ip, user.session_id);
  }

  @Mutation(() => TwoFactorEnrollmentDTO, {
    name: 'enrollTwoFactor',
    description: 'Начать подключение второго фактора: выпустить секрет и otpauth-URI для QR',
  })
  @UseGuards(GqlJwtAuthGuard)
  async enrollTwoFactor(@CurrentUser() user: ICurrentUser): Promise<TwoFactorEnrollmentDTO> {
    const challenge = await this.twoFactor.beginEnrollment(user.id, user.username);
    return { secret: challenge.secret, otpauth_uri: challenge.otpauthUri };
  }

  @Mutation(() => Boolean, {
    name: 'activateTwoFactor',
    description: 'Подтвердить подключение второго фактора первым кодом',
  })
  @UseGuards(GqlJwtAuthGuard)
  async activateTwoFactor(
    @Args('data', { type: () => TwoFactorCodeInputDTO }) data: TwoFactorCodeInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    await this.twoFactor.activate(user.id, data.code, ip);
    // Подключил приложение — фактор включается сразу: иначе пайщик проходил QR,
    // вводил первый код и видел выключенный тумблер, который надо было двигать и
    // подтверждать кодом второй раз.
    await this.loginFactors.onTotpEnrolled(user.id, ip);
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'disableTwoFactor',
    description: 'Отключить второй фактор (требует валидный код)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async disableTwoFactor(
    @Args('data', { type: () => TwoFactorCodeInputDTO }) data: TwoFactorCodeInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    await this.twoFactor.disable(user.id, data.code, ip);
    // Секрета больше нет — TOTP-фактор входа гасится вместе с ним.
    await this.loginFactors.onTotpUnenrolled(user.id);
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'setRecoveryStrategy',
    description: 'Сменить стратегию восстановления (требует step-up второго фактора)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async setRecoveryStrategy(
    @Args('data', { type: () => SetRecoveryStrategyInputDTO }) data: SetRecoveryStrategyInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    await this.recoveryStrategy.setStrategy(user.id, data.strategy, data.code, ip);
    return true;
  }

  @Query(() => LoginFactorsDTO, {
    name: 'getLoginFactors',
    description: 'Настройки подтверждения входа (2FA): какие коды запрашиваются при входе',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getLoginFactors(@CurrentUser() user: ICurrentUser): Promise<LoginFactorsDTO> {
    return this.loginFactors.get(user.id);
  }

  @Mutation(() => LoginFactorsDTO, {
    name: 'setLoginFactors',
    description: 'Изменить настройки подтверждения входа (изменение фактора приложения требует TOTP-код)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async setLoginFactors(
    @Args('data', { type: () => SetLoginFactorsInputDTO }) data: SetLoginFactorsInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<LoginFactorsDTO> {
    return this.loginFactors.set(user.id, data, ip);
  }

  @Query(() => ParticipantLoginSecurityDTO, {
    name: 'getParticipantLoginSecurity',
    description: 'Подтверждение входа у пайщика: подключено ли приложение-аутентификатор (председателю)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getParticipantLoginSecurity(
    @Args('data', { type: () => ResetParticipantTwoFactorInputDTO }) data: ResetParticipantTwoFactorInputDTO,
  ): Promise<ParticipantLoginSecurityDTO> {
    const target = await this.users.getUserByUsername(data.username);
    const factors = await this.loginFactors.get(target.id);
    return { totp_enrolled: factors.totp_enrolled, totp_enabled: factors.totp_enabled };
  }

  @Mutation(() => Boolean, {
    name: 'resetParticipantTwoFactor',
    description: 'Снять приложение-аутентификатор у пайщика (только председатель совета)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async resetParticipantTwoFactor(
    @Args('data', { type: () => ResetParticipantTwoFactorInputDTO }) data: ResetParticipantTwoFactorInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<boolean> {
    // Сброс идёт БЕЗ кода: пайщик потерял телефон, взять код неоткуда — ровно
    // поэтому он и обращается к председателю. Проверка полномочий — на гейте
    // роли, а не на владении устройством.
    const target = await this.users.getUserByUsername(data.username);
    const reset = await this.twoFactor.resetByChairman(target.id, user.username, ip);
    // Настройка «спрашивать код при входе» без секрета мертва — гасим её вместе
    // с приложением, как и при самостоятельном отключении.
    if (reset) await this.loginFactors.onTotpUnenrolled(target.id);
    return reset;
  }

  @Mutation(() => RevokedSessionsResultDTO, {
    name: 'reportNotMe',
    description: 'Сигнал «Это не я»: немедленно завершить все сессии пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async reportNotMe(
    @Args('data', { type: () => ReportNotMeInputDTO }) data: ReportNotMeInputDTO,
    @CurrentUser() user: ICurrentUser,
    @ClientIp() ip: string | null,
  ): Promise<RevokedSessionsResultDTO> {
    return this.incidents.report({
      subjectId: user.id,
      ip,
      source: 'settings',
      reportedSessionId: data.session_id ?? null,
    });
  }
}
