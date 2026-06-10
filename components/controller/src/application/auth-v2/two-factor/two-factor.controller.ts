import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { TwoFactorService } from './two-factor.service';
import type { EnrollmentChallenge } from './two-factor.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

interface CodeBody {
  code?: string;
}

/**
 * Управление вторым фактором (TOTP / Google Authenticator) — CoopID Story 3.6.
 * Все операции — для текущего залогиненного пайщика (HttpJwtAuthGuard → req.user).
 * Subject второго фактора — `user.id` (как `sub` сертификата, Story 1.8).
 */
@Controller('coop/2fa')
@UseFilters(AuthV2ExceptionFilter)
@UseGuards(HttpJwtAuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  /** Начать подключение: выпустить секрет + otpauth-URI для QR. */
  @Post('enroll')
  async enroll(@Req() req: AuthedRequest): Promise<EnrollmentChallenge> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    return this.twoFactor.beginEnrollment(user.id, user.username);
  }

  /** Подтвердить подключение первым кодом. */
  @Post('activate')
  @HttpCode(204)
  async activate(@Body() body: CodeBody, @Req() req: AuthedRequest): Promise<void> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    if (!body?.code) throw new BadRequestException('Требуется code');
    await this.twoFactor.activate(user.id, body.code, req.ip ?? null);
  }

  /** Отключить второй фактор (требует валидный код). */
  @Post('disable')
  @HttpCode(204)
  async disable(@Body() body: CodeBody, @Req() req: AuthedRequest): Promise<void> {
    const user = req.user;
    if (!user?.id) throw new UnauthorizedException();
    if (!body?.code) throw new BadRequestException('Требуется code');
    await this.twoFactor.disable(user.id, body.code, req.ip ?? null);
  }
}
