import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AuthV2ExceptionFilter } from '../exceptions/auth-v2-exception.filter';
import { CertificateService } from './certificate.service';

interface AuthedRequest extends Request {
  user?: { id: string; username: string };
}

/**
 * Выдача participant_certificate (CoopID, Story 1.8). Доступен после успешного
 * логина: защищён платформенным access-token (HttpJwtAuthGuard → req.user).
 * Сертификат выпускается для текущего пайщика (req.user.username).
 */
@Controller('coop/certificate')
@UseFilters(AuthV2ExceptionFilter)
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get()
  @UseGuards(HttpJwtAuthGuard)
  async getCertificate(@Req() req: AuthedRequest): Promise<{ participant_certificate: string }> {
    const username = req.user?.username;
    if (!username) throw new UnauthorizedException();
    // AuthV2Error пробрасывается контурному AuthV2ExceptionFilter (Story 1.11).
    const participant_certificate = await this.certificateService.issueForUsername(username);
    return { participant_certificate };
  }
}
