// src/auth/strategies/jwt.strategy.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import config from '~/config/config';
import { tokenTypes } from '~/types/token.types';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { TOKEN_REPOSITORY, TokenRepository } from '~/domain/token/repositories/token.repository';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(JwtStrategy) {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepository
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.secret,
    });
  }

  /**
   * Сессия, которой выдан токен, ещё жива?
   *
   * Токен несёт claim `sid` — id строки refresh-токена, то есть самой сессии.
   * Завершение сессии удаляет эту строку, и с этого момента access-токен, выданный
   * вместе с ней, перестаёт открывать доступ. Без такой проверки кнопка «Завершить
   * сессию» ничего не меняла: строка удалялась, а токен работал до истечения срока —
   * а срок в поставочной конфигурации измеряется сотнями дней.
   *
   * Токены, выпущенные до появления claim'а, `sid` не содержат и проверку проходят:
   * иначе выкатывание изменения разом разлогинило бы всех действующих пайщиков.
   * Со временем такие токены сойдут на нет сами — новые входы выдают привязанные.
   */
  private async assertSessionAlive(sessionId: unknown): Promise<void> {
    if (typeof sessionId !== 'string' || !sessionId) return;
    const session = await this.tokenRepository.findById(sessionId);
    if (!session || session.blacklisted) {
      // Формулировка не случайна: клиент распознаёт потерю доступа по слову
      // «авторизац» и сам уводит на вход, отдельного кода ошибки для этого нет.
      throw new UnauthorizedException('Сессия завершена, требуется повторная авторизация');
    }
  }

  async validate(payload: any) {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }

    await this.assertSessionAlive(payload.sid);

    const user = await resolveUserBySub(payload.sub, this.userRepository, this.userDomainService);

    // Возвращаем объект в формате, совместимом с MonoAccountDomainInterface
    return {
      // Сессия, которой выдан токен. Нужна, чтобы отличить текущую сессию в списке
      // устройств и не завершить её вместе с чужими. Раньше для этого пришлось бы
      // гонять refresh-токен заголовком на каждом запросе — секрет в транспорте
      // ради опознания; здесь id уже есть в проверенном токене.
      session_id: typeof payload.sid === 'string' ? payload.sid : null,
      id: user.id,
      username: user.username,
      status: user.status,
      message: user.message,
      is_registered: user.is_registered,
      has_account: user.has_account,
      type: user.type,
      public_key: user.public_key,
      referer: user.referer,
      email: user.email,
      role: user.role,
      is_email_verified: user.is_email_verified,
      subscriber_id: user.subscriber_id,
      subscriber_hash: user.subscriber_hash,
    };
  }
}
