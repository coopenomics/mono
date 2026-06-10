import {
  Controller,
  Get,
  HttpException,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { HttpJwtAuthGuard } from '~/application/auth/guards/http-jwt-auth.guard';
import { AuthV2Error, AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
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
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get()
  @UseGuards(HttpJwtAuthGuard)
  async getCertificate(@Req() req: AuthedRequest): Promise<{ participant_certificate: string }> {
    const username = req.user?.username;
    if (!username) throw new UnauthorizedException();
    try {
      const participant_certificate = await this.certificateService.issueForUsername(username);
      return { participant_certificate };
    } catch (e) {
      if (e instanceof AuthV2Error) throw this.toHttp(e);
      throw e;
    }
  }

  private toHttp(e: AuthV2Error): HttpException {
    const body = e.toResponse();
    if (e.code === AuthV2ErrorCode.CooposDegraded) return new ServiceUnavailableException(body);
    return new UnauthorizedException(body);
  }
}
