// src/auth/strategies/jwt.strategy.ts
import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import config from '~/config/config';
import { tokenTypes } from '~/types/token.types';
import { USER_REPOSITORY, UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainService, USER_DOMAIN_SERVICE } from '~/domain/user/services/user-domain.service';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';

@Injectable()
export class JwtAuthStrategy extends PassportStrategy(JwtStrategy) {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE) private readonly userDomainService: UserDomainService
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

    // Возвращаем объект в формате, совместимом с MonoAccountDomainInterface
    return {
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
