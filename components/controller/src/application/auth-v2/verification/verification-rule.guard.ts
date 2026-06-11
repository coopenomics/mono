import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { VerificationTypesService } from './verification-types.service';
import { VerificationRulesService } from './verification-rules.service';
import { REQUIRE_VERIFICATION_METADATA } from './require-verification.decorator';

interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

/**
 * Guard уровня верификации (CoopID, Story 4.2). Для endpoint'а с
 * `@RequireVerification(actionCode)` проверяет, что у текущего пайщика есть все
 * типы верификации, обязательные правилом действия. Нет правила (или пустой список
 * требований) → пропускает: отсутствие ограничения, а не отказ. Не хватает типа →
 * `AuthV2Error(InsufficientVerification)`, который контурный `AuthV2ExceptionFilter`
 * отдаёт как `403`.
 *
 * Идёт после `HttpJwtAuthGuard` (он выставляет `req.user.username`). Типы пайщика
 * берутся из резолвера Story 4.1 (`VerificationTypesService`), а не из блокчейна
 * напрямую — единый источник членства.
 */
@Injectable()
export class VerificationRuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rulesService: VerificationRulesService,
    private readonly verificationTypesService: VerificationTypesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actionCode = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_VERIFICATION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!actionCode) return true;

    const required = await this.rulesService.getRequiredTypes(actionCode);
    if (!required.length) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const username = req.user?.username;
    if (!username) throw new UnauthorizedException();

    const entries = await this.verificationTypesService.resolveForUsername(username);
    const present = new Set(entries.map((e) => e.type));
    const missing = required.filter((t) => !present.has(t));
    if (missing.length) {
      throw new AuthV2Error(
        AuthV2ErrorCode.InsufficientVerification,
        `Недостаточный уровень верификации для действия «${actionCode}»: требуется ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
