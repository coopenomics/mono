import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { VerificationOnsiteService } from './verification-onsite.service';
import {
  ParticipantVerificationDTO,
  UnverifyParticipantInputDTO,
  VerifyParticipantOnsiteInputDTO,
} from './dto/verification.dto';

interface ICurrentUser {
  id: string;
  username: string;
}

/**
 * GraphQL-фасад верификации личности пайщика. Полномочия проверяет контракт:
 * верифицировать может председатель кооперативного участка или его доверенное
 * лицо (`registrator::verifyacc`), отзывать — председатель кооператива
 * (`registrator::unverifyacc`). Сервер лишь подставляет текущего пользователя
 * как действующее лицо и подписывает транзакцию его ключом.
 */
@Resolver()
export class VerificationResolver {
  constructor(private readonly verificationOnsiteService: VerificationOnsiteService) {}

  @Mutation(() => [ParticipantVerificationDTO], {
    name: 'verifyParticipantOnsite',
    description: 'Подтвердить личность пайщика по паспорту на кооперативном участке',
  })
  @UseGuards(GqlJwtAuthGuard)
  async verifyParticipantOnsite(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: VerifyParticipantOnsiteInputDTO,
  ): Promise<ParticipantVerificationDTO[]> {
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
    return this.verificationOnsiteService.unverify(user.username, data.username);
  }
}
