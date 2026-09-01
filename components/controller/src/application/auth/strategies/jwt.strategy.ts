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
import { VaultService } from '~/application/auth-v2/vault/vault.service';
import { USER_ACTIVITY_PORT, type UserActivityPort } from '~/domain/metrics/ports/user-activity.port';

/**
 * Сколько помнить ответ «перешёл ли пайщик на пароль». Проверка стоит на каждом
 * запросе легаси-токена, а ответ меняется один раз в жизни аккаунта — с «нет»
 * на «да». Минута задержки между установкой пароля и выбросом старых сессий
 * ничего не стоит, а запрос к базе на каждый клик — стоит.
 */
const MIGRATED_CACHE_MS = 60_000;

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(JwtStrategy) {
  private readonly migratedAt = new Map<string, { migrated: boolean; checkedAt: number }>();

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepository,
    private readonly vault: VaultService,
    @Inject(USER_ACTIVITY_PORT) private readonly activity: UserActivityPort
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
   *
   * Одно исключение из этой уступки: пайщик, уже перешедший на пароль. Переход
   * отзывает все его сессии — но отзыв удаляет строки refresh-токенов, а токен
   * без `sid` ни к какой строке не привязан и отзыва не замечает. Получалось,
   * что на втором устройстве старая сессия жила как ни в чём не бывало: ключ
   * в цепи уже погашен, пароль уже стоит, а вкладка ходит по кабинету до
   * истечения срока токена — сотни дней. Именно это заметил председатель
   * 23.08.2026, открыв кабинет с телефона после установки пароля на ноутбуке.
   *
   * Признак перехода — vault-блоб пайщика: он появляется ровно в момент
   * установки пароля и нигде больше. Есть блоб — токен без `sid` выдан до
   * перехода и обязан умереть; нет блоба — пайщик ещё на ключе, и уступка
   * для него в силе.
   */
  private async assertSessionAlive(sessionId: unknown, username: string): Promise<void> {
    if (typeof sessionId !== 'string' || !sessionId) {
      if (await this.hasMigrated(username)) {
        throw new UnauthorizedException('Сессия завершена, требуется повторная авторизация');
      }
      return;
    }
    const session = await this.tokenRepository.findById(sessionId);
    if (!session || session.blacklisted) {
      // Формулировка не случайна: клиент распознаёт потерю доступа по слову
      // «авторизац» и сам уводит на вход, отдельного кода ошибки для этого нет.
      throw new UnauthorizedException('Сессия завершена, требуется повторная авторизация');
    }
  }

  private async hasMigrated(username: string): Promise<boolean> {
    const cached = this.migratedAt.get(username);
    const now = Date.now();
    // «Да» — навсегда: назад с пароля на ключ пайщик не возвращается.
    if (cached && (cached.migrated || now - cached.checkedAt < MIGRATED_CACHE_MS)) return cached.migrated;
    const blob = await this.vault.retrieve({ subject_type: 'participant', subject_id: username });
    const migrated = blob !== null;
    this.migratedAt.set(username, { migrated, checkedAt: now });
    return migrated;
  }

  async validate(payload: any) {
    if (payload.type !== tokenTypes.ACCESS) {
      throw new Error('Invalid token type');
    }

    const user = await resolveUserBySub(payload.sub, this.userRepository, this.userDomainService);

    await this.assertSessionAlive(payload.sid, user.username);

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
