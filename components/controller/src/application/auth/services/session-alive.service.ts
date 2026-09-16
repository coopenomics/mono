import { Inject, Injectable } from '@nestjs/common';
import { TOKEN_REPOSITORY, TokenRepository } from '~/domain/token/repositories/token.repository';
import { VaultService } from '~/application/auth-v2/vault/vault.service';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';
import { registerWsSessionCheck } from '~/infrastructure/graphql/ws-session-check.registry';

/**
 * Сколько помнить ответ «перешёл ли пайщик на пароль». Проверка стоит на каждом
 * запросе легаси-токена, а ответ меняется один раз в жизни аккаунта — с «нет»
 * на «да». Минута задержки между установкой пароля и выбросом старых сессий
 * ничего не стоит, а запрос к базе на каждый клик — стоит.
 */
const MIGRATED_CACHE_MS = 60_000;

/**
 * Жива ли сессия, которой выдан токен, — общий ответ для ВСЕХ входов в систему.
 *
 * Раньше эта логика жила только в `JwtAuthStrategy`, то есть покрывала HTTP, а
 * веб-сокет проверял у токена лишь подпись и тип. Отозванный доступ оставался
 * наполовину живым: отвергнутые HTTP-запросы не давали собрать кабинет, а
 * подписки и уведомления через ws работали как ни в чём не бывало. Пайщик
 * `pgrzosdeyuwg` 08.09.2026 просидел так несколько часов — меню на месте,
 * кошелька и кнопки выхода нет, по центру предложение вступить в пайщики.
 *
 * Поэтому проверка одна на всех, а её потребители — стратегия HTTP и `onConnect`
 * веб-сокета (через {@link registerWsSessionCheck}: `GraphQLModule.forRoot`
 * статичен и провайдера в себя не инжектит).
 */
@Injectable()
export class SessionAliveService {
  private readonly migratedAt = new Map<string, { migrated: boolean; checkedAt: number }>();

  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
    private readonly vault: VaultService
  ) {
    // Отдаём проверку веб-сокету. Регистрация в конструкторе, а не в onModuleInit:
    // соединение может прийти раньше полной инициализации приложения, и до
    // регистрации ws пускал бы всех — ровно то поведение, которое чиним.
    registerWsSessionCheck((sessionId, sub) => this.isAliveBySub(sessionId, sub));
  }

  /**
   * То же для входа, у которого на руках только `sub` токена, — веб-сокета.
   * Резолв нужен именно здесь: `sub` это идентификатор учётной записи, а признак
   * перехода на пароль (vault-блоб) хранится по имени аккаунта пайщика.
   * Пайщика по `sub` не нашли — сессии нет и быть не может.
   */
  async isAliveBySub(sessionId: unknown, sub: unknown): Promise<boolean> {
    if (typeof sub !== 'string' || !sub) return false;
    try {
      const user = await resolveUserBySub(sub, this.userRepository, this.userDomainService);
      return await this.isAlive(sessionId, user.username);
    } catch {
      return false;
    }
  }

  /**
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
  async isAlive(sessionId: unknown, username: string): Promise<boolean> {
    if (typeof sessionId !== 'string' || !sessionId) {
      return !(await this.hasMigrated(username));
    }
    const session = await this.tokenRepository.findById(sessionId);
    return Boolean(session) && !session?.blacklisted;
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
}
