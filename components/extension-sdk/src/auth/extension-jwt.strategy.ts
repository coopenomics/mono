import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';

export interface ExtensionJwtPayload {
  sub: string;
  username: string;
  coopname?: string;
  type?: string;
  scope?: string[];
  iat?: number;
  exp?: number;
}

export interface ExtensionJwtStrategyOptions {
  secret: string;
}

/**
 * JWT-стратегия для расширения. Validate'ит токен, который Apollo Gateway
 * forward'ит в `Authorization: Bearer …` заголовке. Не выдаёт токены — это
 * делает core-coopback; расширение только проверяет подпись и срок.
 *
 * **Контракт payload'а** — фиксирован core'ом: `sub`, `username`, `coopname`,
 * `type`. Поле `scope: string[]` опционально и используется для apps-catalog
 * подписок (`@scope("@voskhod/chatcoop")`).
 *
 * Поле `secret` приходит из env (`JWT_SECRET`) — обязательно совпадает с
 * core'овым. Никакой выдачи токенов на расширении.
 */
@Injectable()
export class ExtensionJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(options: ExtensionJwtStrategyOptions) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: options.secret,
    });
  }

  async validate(payload: ExtensionJwtPayload): Promise<ExtensionJwtPayload> {
    return payload;
  }
}
