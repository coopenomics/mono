import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { GqlJwtAuthGuard, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { AccountDTO } from '~/application/account/dto/account.dto';
import { ParticipantService } from '../services/participant.service';
import { AddParticipantInputDTO } from '../dto/add-participant-input.dto';

@Resolver()
export class ParticipantResolver {
  constructor(private readonly participantService: ParticipantService) {}

  @Mutation(() => AccountDTO, {
    name: 'addParticipant',
    description:
      'Добавить активного пайщика, который вступил в кооператив, не используя платформу (заполнив заявление собственноручно, оплатив вступительный и минимальный паевый взносы, и получив протокол решения совета)',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('Participant', 'create')
  async addParticipant(
    @Args('data', { type: () => AddParticipantInputDTO })
    data: AddParticipantInputDTO
  ): Promise<AccountDTO> {
    return this.participantService.addParticipant(data);
  }
}
