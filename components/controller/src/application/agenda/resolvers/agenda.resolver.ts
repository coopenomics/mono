import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { RolesGuard } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '@coopenomics/extension-kit';
import { AgendaService } from '../services/agenda.service';
import { AgendaWithDocumentsDTO } from '../dto/agenda-with-documents.dto';

@Resolver()
export class AgendaResolver {
  constructor(private readonly agendaService: AgendaService) {}
  //TODO add votefor / voteagainst

  @Query(() => [AgendaWithDocumentsDTO], {
    name: 'getAgenda',
    description: 'Получить список вопросов совета кооператива для голосования',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getAgenda(): Promise<AgendaWithDocumentsDTO[]> {
    return this.agendaService.getAgenda();
  }
}
