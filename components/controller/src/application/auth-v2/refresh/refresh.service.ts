import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenApplicationService } from '~/application/token/services/token-application.service';
import { USER_DOMAIN_SERVICE, UserDomainService } from '~/domain/user/services/user-domain.service';
import { tokenTypes } from '~/types/token.types';

export interface RefreshResult {
  access_token: string;
  refresh_token: string;
}

/**
 * Обновление пары токенов по refresh-токену для контура CoopID (Эпик 7, REST).
 *
 * Намеренно переиспользует ту же платформенную токен-машинерию
 * (`TokenApplicationService` → `generateAuthTokens`/`config.jwt.secret`), что и
 * legacy GraphQL-`refresh`. Логика зеркалит legacy `AuthInteractor.refresh`:
 * токены обоих контуров структурно идентичны (claims `{sub,iat,exp,type}`, один
 * секрет), поэтому refresh-токен, выданный legacy-входом ИЛИ auth-v2
 * verify-timestamp, обновляется здесь одинаково. Это и есть REST-зеркало
 * GraphQL-refresh, а не отдельный механизм — инвариант равноправия токенов держится.
 */
@Injectable()
export class RefreshService {
  constructor(
    private readonly tokens: TokenApplicationService,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService,
  ) {}

  async refresh(refreshToken: string): Promise<RefreshResult> {
    let userId: string;
    let sessionId: string | undefined;
    try {
      const doc = await this.tokens.verifyToken({ token: refreshToken, types: [tokenTypes.REFRESH] });
      userId = doc.userId;
      sessionId = doc.id;
    } catch {
      throw new UnauthorizedException('refresh_token недействителен или отозван');
    }

    // UUID (новые пользователи) либо legacy MongoDB ObjectId (старые) — как в legacy refresh.
    const user = (await this.userDomainService.findUserById(userId)) ?? (await this.userDomainService.findUserByLegacyMongoId(userId));
    if (!user) throw new UnauthorizedException('Пользователь не найден');

    // Ротация: старый refresh «сгорает», выпускается новая пара. Строку токена при
    // этом переиспользуем — её id и есть id сессии, он стоит в выданных access-токенах
    // claim'ом `sid`. Пересоздание строки выглядело бы как новая сессия в списке
    // устройств и обесценивало бы токены, выданные до обновления.
    let pair;
    if (sessionId) {
      pair = await this.tokens.rotateAuthTokens(user.id, sessionId);
    } else {
      // Строка без id — теоретический случай (первичный ключ есть всегда); тогда
      // ведём себя как раньше: старую гасим, выпускаем новую сессию.
      await this.tokens.findOneAndDelete(refreshToken, tokenTypes.REFRESH);
      pair = await this.tokens.generateAuthTokens(user.id);
    }

    return { access_token: pair.access.token, refresh_token: pair.refresh.token };
  }
}
