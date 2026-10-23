import { Inject, Injectable, Logger } from '@nestjs/common';
import { TOKEN_REPOSITORY, TokenRepository } from '~/domain/token/repositories/token.repository';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { tokenTypes } from '~/types/token.types';
import { AccountService } from '~/application/account/services/account.service';
import { DesktopService } from '~/application/desktop/services/desktop.service';
import type { AccountDTO } from '~/application/account/dto/account.dto';
import type { DesktopDTO } from '~/application/desktop/dto/desktop.dto';
import { readSessionCookie } from '~/application/auth-v2/session-cookie/session-cookie';

/**
 * Что серверный рендер знает о запросившем документ.
 *
 * - `guest` — cookie сессии нет, страница собирается для гостя;
 * - `expired` — cookie есть, но сессия завершена, отозвана или истекла:
 *   кабинет обязан показать «Войдите», а не гостевой стол;
 * - `active` — пайщик опознан. Аккаунт и стол приходят сразу, чтобы первый
 *   рендер уже был его: без повторного «входа» на клиенте, из-за которого
 *   пайщика уносило на «Недостаточно прав доступа» и «404».
 *
 * Аккаунт или стол могут не собраться (цепь молчит) — тогда поле пустое,
 * а статус остаётся `active`: личность известна, данные догрузит клиент.
 */
export interface SsrContextResult {
  status: 'guest' | 'active' | 'expired';
  username?: string;
  account?: AccountDTO | null;
  desktop?: DesktopDTO | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class SsrContextService {
  private readonly logger = new Logger(SsrContextService.name);

  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokens: TokenRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly accounts: AccountService,
    private readonly desktops: DesktopService
  ) {}

  async resolve(cookieHeader: string | undefined): Promise<SsrContextResult> {
    const sid = readSessionCookie(cookieHeader);
    if (!sid) return { status: 'guest' };
    // id строки сессии — uuid; чужое значение в cookie — не сессия, а мусор,
    // и в базу с ним ходить незачем (postgres ответил бы ошибкой, а не «нет»).
    if (!UUID_RE.test(sid)) return { status: 'expired' };

    // Та же проверка, что у стратегии JWT: строка сессии жива, не в чёрном
    // списке и не просрочена. Отозванная сессия для SSR — «войдите заново».
    const session = await this.tokens.findById(sid);
    if (!session || session.type !== tokenTypes.REFRESH || session.blacklisted) return { status: 'expired' };
    if (session.expires && new Date(session.expires).getTime() <= Date.now()) return { status: 'expired' };

    const user = await this.users.findById(session.userId);
    if (!user) return { status: 'expired' };

    const [account, desktop] = await Promise.all([
      this.accounts.getAccount(user.username).catch((e: unknown) => {
        this.logger.warn(`SSR: аккаунт ${user.username} не собран: ${e instanceof Error ? e.message : e}`);
        return null;
      }),
      this.desktops.getDesktop({ username: user.username, role: user.role, status: user.status }).catch((e: unknown) => {
        this.logger.warn(`SSR: стол ${user.username} не собран: ${e instanceof Error ? e.message : e}`);
        return null;
      }),
    ]);

    return { status: 'active', username: user.username, account, desktop };
  }
}
