import { BadRequestException, Controller, Get, Headers, Inject, Query, UnauthorizedException } from '@nestjs/common';
import config from '~/config/config';
import { USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import type { UserDomainService } from '~/domain/user/services/user-domain.service';
import {
  VerificationType,
  type VerificationTypeEntry,
} from '~/domain/auth-v2/verification/verification.types';
import { VerificationTypesService } from '../verification/verification-types.service';
import { tokenMatches } from '../internal-token.util';

/**
 * Claims пайщика для OIDC-провайдеров, обслуживающих внешние сервисы сети
 * (первый потребитель — клиент card.coop, Story 7.0 карты кооператора, FR-E1).
 *
 * Состав отвечает на единственный вопрос внешней стороны: «этот человек —
 * действующий пайщик такого-то кооператива, и с какого момента». Персональных
 * данных здесь нет и быть не должно: анкеты остаются в кооперативе, наружу идёт
 * подтверждение, а не сведения (принцип «подтверждение вместо данных»).
 */
export interface ParticipantClaims {
  /** Кооператив — имя аккаунта в цепи; он же издатель claims. */
  coopname: string;
  /** Имя блокчейн-аккаунта пайщика в этом кооперативе. */
  username: string;
  /** Почта пайщика по данным кооператива; `null`, если её нет. */
  email: string | null;
  /**
   * Подтверждена ли эта почта кооперативом. Стандартный маппинг authentik
   * отвечает на этот вопрос всегда `false` — он о почте ничего не знает, её
   * подтверждает контроллер при регистрации. Внешняя сторона (card.coop) по
   * этому признаку решает, слать ли собственное письмо подтверждения (FR-A2а).
   */
  email_verified: boolean;
  /** Действующий ли член кооператива на момент запроса. */
  member: boolean;
  /**
   * С какого момента человек принят в кооператив, ISO-8601 (UTC), либо `null`
   * у не-члена. Дата приёма — это `verified_at` начального уровня верификации:
   * запись участника в цепи и есть решение кооператива о приёме.
   */
  member_since: string | null;
  /** Подтверждённые уровни верификации — тот же состав, что в participant_certificate. */
  verification_types: VerificationTypeEntry[];
}

/**
 * Сборка claims из уровней верификации. Чистая функция — вся условная логика
 * ответа проверяется юнит-тестами без сети и цепи.
 *
 * Членство НЕ выводится отдельным запросом статуса участника: единственным
 * источником истины остаётся резолвер начального уровня `coop_baseline`,
 * который сам читает он-чейн запись участника. Иначе два места отвечали бы на
 * один вопрос и однажды разошлись бы — например, при смене статусов в цепи.
 *
 * @param coopname — кооператив, от имени которого выдаются claims.
 * @param username — имя блокчейн-аккаунта пайщика.
 * @param types — уровни верификации, полученные из резолверов.
 * @param account — почта пайщика и признак её подтверждения; `null`, если
 *   учётной записи в кооперативе нет.
 * @returns Готовые claims: членство, дата приёма, почта и уровни верификации.
 */
export function buildParticipantClaims(
  coopname: string,
  username: string,
  types: VerificationTypeEntry[],
  account: { email: string; is_email_verified: boolean } | null,
): ParticipantClaims {
  const baseline = types.find((entry) => entry.type === VerificationType.CoopBaseline);
  return {
    coopname,
    username,
    email: account?.email || null,
    email_verified: Boolean(account?.email) && Boolean(account?.is_email_verified),
    member: Boolean(baseline),
    member_since: baseline?.verified_at ?? null,
    verification_types: types,
  };
}

/**
 * Internal-маршрут claims: его вызывает property mapping authentik в момент
 * выдачи токена внешнему клиенту (Story 7.0). Наружу не маршрутизируется —
 * достижим только из docker-сети и защищён тем же shared-токеном, что и приём
 * событий authentik.
 *
 * Почему запросом в момент выдачи, а не атрибутами учётной записи: членство
 * прекращается решением кооператива в цепи, а не действием в authentik.
 * Атрибуты, проставленные однажды, пережили бы исключение пайщика и заявляли бы
 * внешнему сервису членство, которого больше нет.
 */
@Controller('coop/internal')
export class ParticipantClaimsController {
  constructor(
    private readonly verificationTypes: VerificationTypesService,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
  ) {}

  /**
   * Claims пайщика по имени блокчейн-аккаунта.
   *
   * @param token — shared-токен внутреннего контура (`X-Authentik-Webhook-Token`).
   * @param username — имя аккаунта пайщика в цепи.
   * @returns Claims членства; у не-члена `member: false` и пустые уровни.
   * @throws UnauthorizedException Если токен не совпал или контур не настроен.
   * @throws BadRequestException Если имя аккаунта не передано.
   */
  @Get('participant-claims')
  async getClaims(
    @Headers('x-authentik-webhook-token') token: string | undefined,
    @Query('username') username: string | undefined,
  ): Promise<ParticipantClaims> {
    if (!tokenMatches(token, config.authV2.webhookToken)) throw new UnauthorizedException();
    if (!username) throw new BadRequestException('username обязателен');

    const coopname = config.coopname;
    const [types, account] = await Promise.all([
      this.verificationTypes.resolveForUsername(username, coopname),
      this.findAccount(username),
    ]);
    return buildParticipantClaims(coopname, username, types, account);
  }

  /**
   * Учётная запись пайщика в кооперативе или `null`, если её нет.
   *
   * Отсутствие записи — обычное дело (аккаунт в цепи есть, регистрации в
   * кооперативе нет), поэтому оно не превращается в ошибку запроса: claims
   * просто выходят без почты.
   */
  private async findAccount(username: string): Promise<{ email: string; is_email_verified: boolean } | null> {
    try {
      const user = await this.userDomainService.getUserByUsername(username);
      return { email: user.email, is_email_verified: user.is_email_verified };
    } catch {
      return null;
    }
  }
}
