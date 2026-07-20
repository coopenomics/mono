import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import config from '~/config/config';
import { tokenTypes, type TokenType } from '~/types/token.types';
import { TokenRepository, TOKEN_REPOSITORY } from '../repositories/token.repository';
import type { TokenDomainInterface } from '../interfaces/token-domain.interface';
import type { CreateTokenInputDomainInterface } from '../interfaces/create-token-input-domain.interface';
import type { GenerateTokenInputDomainInterface } from '../interfaces/generate-token-input-domain.interface';
import type { VerifyTokenInputDomainInterface } from '../interfaces/verify-token-input-domain.interface';
import type { TokenPairDomainInterface } from '../interfaces/token-pair-domain.interface';
import type { ServiceTokenDomainInterface } from '../interfaces/service-token-domain.interface';

/**
 * Доменный сервис для работы с токенами
 * Содержит бизнес-логику генерации, верификации и управления токенами
 */
@Injectable()
export class TokenDomainService {
  constructor(
    @Inject(TOKEN_REPOSITORY)
    private readonly tokenRepository: TokenRepository
  ) {}

  /**
   * Генерирует JWT токен
   */
  generateToken(input: GenerateTokenInputDomainInterface): string {
    const payload = {
      sub: input.userId,
      iat: moment().unix(),
      exp: Math.floor(input.expires.getTime() / 1000), // Конвертируем Date в timestamp
      type: input.type,
    };

    return jwt.sign(payload, input.secret || config.jwt.secret);
  }

  /**
   * Сохраняет токен в репозитории
   */
  async saveToken(
    token: string,
    userId: string,
    expires: Date,
    type: TokenType,
    blacklisted = false
  ): Promise<TokenDomainInterface> {
    const tokenData: CreateTokenInputDomainInterface = {
      token,
      userId,
      type,
      expires,
      blacklisted,
    };

    return this.tokenRepository.create(tokenData);
  }

  /**
   * Верифицирует токен и возвращает его данные
   */
  async verifyToken(input: VerifyTokenInputDomainInterface): Promise<TokenDomainInterface> {
    try {
      const payload = jwt.verify(input.token, config.jwt.secret) as any;

      const tokenDoc = await this.tokenRepository.findByTokenAndTypes(input.token, input.types);

      if (!tokenDoc) {
        throw new Error('Token not found');
      }

      // Проверяем, что токен принадлежит правильному пользователю
      if (tokenDoc.userId !== payload.sub) {
        throw new Error('Token user mismatch');
      }

      // Проверяем, что токен не в черном списке
      if (tokenDoc.blacklisted) {
        throw new Error('Token is blacklisted');
      }

      return tokenDoc;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token expired');
      }
      throw new UnauthorizedException('Token verification failed');
    }
  }

  /**
   * Генерирует пару токенов авторизации (access + refresh)
   */
  async generateAuthTokens(userId: string): Promise<TokenPairDomainInterface> {
    const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
    const accessToken = this.generateToken({
      userId,
      expires: accessTokenExpires.toDate(),
      type: tokenTypes.ACCESS,
    });

    const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
    const refreshToken = this.generateToken({
      userId,
      expires: refreshTokenExpires.toDate(),
      type: tokenTypes.REFRESH,
    });

    // Сохраняем refresh токен
    await this.saveToken(refreshToken, userId, refreshTokenExpires.toDate(), tokenTypes.REFRESH);

    return {
      access: {
        token: accessToken,
        expires: accessTokenExpires.toDate(),
      },
      refresh: {
        token: refreshToken,
        expires: refreshTokenExpires.toDate(),
      },
    };
  }

  /**
   * Генерирует сервисный токен доступа
   */
  async generateServiceAccessToken(userId: string): Promise<ServiceTokenDomainInterface> {
    // Очень долгий срок действия для сервисных токенов (100 лет)
    const accessTokenExpires = moment().add(100, 'years');
    const accessToken = this.generateToken({
      userId,
      expires: accessTokenExpires.toDate(),
      type: tokenTypes.ACCESS,
    });

    return {
      access: {
        token: accessToken,
        expires: accessTokenExpires.toDate(),
      },
    };
  }

  /**
   * Генерирует токен сброса ключа
   */
  async generateResetKeyToken(email: string, userId: string): Promise<string> {
    const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
    const resetKeyToken = this.generateToken({
      userId,
      expires: expires.toDate(),
      type: tokenTypes.RESET_KEY,
    });

    await this.saveToken(resetKeyToken, userId, expires.toDate(), tokenTypes.RESET_KEY);
    return resetKeyToken;
  }

  /**
   * Генерирует токен приглашения
   */
  async generateInviteToken(email: string, userId: string): Promise<string> {
    const expires = moment().add(config.jwt.inviteExpirationMinutes, 'minutes');
    const inviteToken = this.generateToken({
      userId,
      expires: expires.toDate(),
      type: tokenTypes.INVITE,
    });

    await this.saveToken(inviteToken, userId, expires.toDate(), tokenTypes.INVITE);
    return inviteToken;
  }

  /**
   * Генерирует токен верификации email
   */
  async generateVerifyEmailToken(userId: string): Promise<string> {
    const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
    const verifyEmailToken = this.generateToken({
      userId,
      expires: expires.toDate(),
      type: tokenTypes.VERIFY_EMAIL,
    });

    await this.saveToken(verifyEmailToken, userId, expires.toDate(), tokenTypes.VERIFY_EMAIL);
    return verifyEmailToken;
  }

  /**
   * Генерирует токен подтверждения выхода из кооператива (ссылка в письме).
   * Срок жизни — как у верификации email (это тоже подтверждение по почте).
   */
  async generateConfirmExitToken(userId: string): Promise<string> {
    const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
    const confirmExitToken = this.generateToken({
      userId,
      expires: expires.toDate(),
      type: tokenTypes.CONFIRM_EXIT,
    });

    await this.saveToken(confirmExitToken, userId, expires.toDate(), tokenTypes.CONFIRM_EXIT);
    return confirmExitToken;
  }

  /**
   * Удаляет токены по критериям
   */
  async deleteTokens(criteria: Partial<TokenDomainInterface>): Promise<number> {
    return this.tokenRepository.deleteMany(criteria);
  }

  /**
   * Находит токен по значению и типу и удаляет его
   */
  async findOneAndDelete(token: string, type: TokenType): Promise<TokenDomainInterface | null> {
    return this.tokenRepository.findOneAndDelete(token, type);
  }

  /**
   * Обновляет токен по ID
   */
  async updateToken(id: string, updates: Partial<TokenDomainInterface>): Promise<TokenDomainInterface | null> {
    return this.tokenRepository.updateById(id, updates);
  }
}
