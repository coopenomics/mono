import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import { CertificateService } from './certificate.service';
import { ParticipantCertificateDTO } from './dto/certificate.dto';
import { RequestCooperativeEndorsementInputDTO } from './dto/request-endorsement.input';
import { EndorsementService } from './endorsement.service';

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
  constructor(
    private readonly certificateService: CertificateService,
    private readonly endorsementService: EndorsementService,
  ) {}

  @Query(() => ParticipantCertificateDTO, {
    name: 'getMyCertificate',
    description: 'Получить удостоверение текущего пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMyCertificate(@CurrentUser() user: ICurrentUser): Promise<ParticipantCertificateDTO> {
    const participant_certificate = await this.certificateService.issueForUsername(user.username);
    return { participant_certificate };
  }

  @Mutation(() => Boolean, {
    name: 'requestCooperativeEndorsement',
    description: 'Заверить ключ заверения обслуживаемого кооператива сразу после его публикации',
  })
  async requestCooperativeEndorsement(
    @Args('data', { type: () => RequestCooperativeEndorsementInputDTO }) data: RequestCooperativeEndorsementInputDTO,
  ): Promise<boolean> {
    // Без авторизации: зовёт узел кооператива сразу после ввода ключа установки.
    // Решает только цепь (endorseOnRequest): чужой, недействующий кооператив или
    // кооператив без ключа заверения не заверяется; повтор ничего не меняет.
    return (await this.endorsementService.endorseOnRequest(data.coopname)).endorsed;
  }
}
