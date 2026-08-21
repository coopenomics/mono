import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { VerificationOnsiteService } from './verification-onsite.service';
import { VerificationIdentityService } from './verification-identity.service';
import { VerificationAuthorityService } from './verification-authority.service';
import {
  ParticipantIdentityForVerificationDTO,
  ParticipantIdentityForVerificationInputDTO,
  ParticipantVerificationDTO,
  UnverifyParticipantInputDTO,
  VerifyParticipantOnsiteInputDTO,
} from './dto/verification.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role: string;
}

/**
 * GraphQL-фасад верификации личности пайщика.
 *
 * Сверять личность вправе кооперативный участок (председатель участка или его
 * доверенное лицо — тогда указан участок) либо совет кооператива (тогда участок
 * не указан); отзывать — председатель совета. Транзакцию подписывает кооператив:
 * личные ключи пайщиков хранятся у них самих, поэтому полномочия проверяет
 * сервер (`VerificationAuthorityService`), а на участке их дополнительно
 * подтверждает контракт по таблице участка.
 */
@Resolver()
export class VerificationResolver {
  constructor(
    private readonly verificationOnsiteService: VerificationOnsiteService,
    private readonly verificationIdentityService: VerificationIdentityService,
    private readonly verificationAuthorityService: VerificationAuthorityService,
  ) {}

  @Query(() => ParticipantIdentityForVerificationDTO, {
    name: 'participantIdentityForVerification',
    description: 'Данные пайщика для сверки с документом; выдаются, пока личность не подтверждена',
  })
  @UseGuards(GqlJwtAuthGuard)
  async participantIdentityForVerification(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: ParticipantIdentityForVerificationInputDTO,
  ): Promise<ParticipantIdentityForVerificationDTO> {
    return this.verificationIdentityService.getForVerification(
      { username: user.username, role: user.role, braname: data.braname },
      data.username,
    );
  }

  @Mutation(() => [ParticipantVerificationDTO], {
    name: 'verifyParticipantOnsite',
    description: 'Подтвердить личность пайщика по паспорту при личной явке',
  })
  @UseGuards(GqlJwtAuthGuard)
  async verifyParticipantOnsite(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: VerifyParticipantOnsiteInputDTO,
  ): Promise<ParticipantVerificationDTO[]> {
    await this.verificationAuthorityService.assertMayVerify({
      username: user.username,
      role: user.role,
      braname: data.braname,
    });
    return this.verificationOnsiteService.verifyOnsite(user.username, data.username, data.braname);
  }

  @Mutation(() => [ParticipantVerificationDTO], {
    name: 'unverifyParticipant',
    description: 'Отозвать верификацию личности пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async unverifyParticipant(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: UnverifyParticipantInputDTO,
  ): Promise<ParticipantVerificationDTO[]> {
    this.verificationAuthorityService.assertMayUnverify({ username: user.username, role: user.role });
    return this.verificationOnsiteService.unverify(user.username, data.username);
  }
}
