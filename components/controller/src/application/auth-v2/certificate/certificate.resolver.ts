import { Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import { CertificateService } from './certificate.service';
import { ParticipantCertificateDTO } from './dto/certificate.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role?: string;
}

/**
 * GraphQL-фасад выдачи удостоверения пайщика (Story 1.8). Заменяет REST `coop/certificate`:
 * сертификат для текущего пайщика отдаётся через @coopenomics/sdk (Zeus), защищён
 * платформенным access-token (GqlJwtAuthGuard → CurrentUser). AuthV2Error пробрасывается
 * контурному фильтру как и прежде.
 */
@Resolver()
export class CertificateResolver {
  constructor(private readonly certificateService: CertificateService) {}

  @Query(() => ParticipantCertificateDTO, {
    name: 'getMyCertificate',
    description: 'Получить удостоверение текущего пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMyCertificate(@CurrentUser() user: ICurrentUser): Promise<ParticipantCertificateDTO> {
    const participant_certificate = await this.certificateService.issueForUsername(user.username);
    return { participant_certificate };
  }
}
