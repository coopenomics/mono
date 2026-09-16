// src/auth/strategies/jwt.strategy.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import config from '~/config/config';
import { tokenTypes } from '~/types/token.types';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';
import { SessionAliveService } from '~/application/auth/services/session-alive.service';
import { USER_ACTIVITY_PORT, type UserActivityPort } from '~/domain/metrics/ports/user-activity.port';

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(JwtStrategy) {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    private readonly sessionAlive: SessionAliveService,
    @Inject(USER_ACTIVITY_PORT) private readonly activity: UserActivityPort
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.secret,
    });
  }

  async validate(payload: any) {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }

    const user = await resolveUserBySub(payload.sub, this.userRepository, this.userDomainService);

    if (!(await this.sessionAlive.isAlive(payload.sid, user.username))) {
      // Формулировка не случайна: клиент распознаёт потерю доступа по слову
      // «авторизац» и сам уводит на вход, отдельного кода ошибки для этого нет.
      throw new UnauthorizedException('Сессия завершена, требуется повторная авторизация');
    }

    // След захода — здесь и только здесь. Это единственная точка, через которую
    // проходит КАЖДЫЙ авторизованный запрос пайщика и в которой он уже опознан.
    //
    // Считать активность по таблице токенов нельзя: она фиксирует выдачу токена,
    // то есть вход, а срок жизни токена в поставочной конфигурации измеряется
    // сотнями дней — пайщик, работающий в кабинете ежедневно, оставил бы там одну
    // строку за всё время.
    //
    // Намеренно БЕЗ await: запись следа не должна добавлять пайщику ожидания на
    // каждом запросе, а сама она молчалива и ошибку наружу не выпускает.
    void this.activity.markActive(user.username);

    // Возвращаем объект в формате, совместимом с IMonoAccount
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
