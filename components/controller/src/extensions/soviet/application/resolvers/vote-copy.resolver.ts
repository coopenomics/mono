import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { CreateVoteCopyInputDTO, VoteCopySettingDTO } from '../dto/vote-copy.dto';
import { VoteCopyService } from '../../domain/services/vote-copy.service';

@Resolver(() => VoteCopySettingDTO)
export class VoteCopyResolver {
  constructor(private readonly voteCopyService: VoteCopyService) {}

  @Query(() => [VoteCopySettingDTO], {
    name: 'getMyVoteCopySettings',
    description: 'Мои настройки копирования голосов',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getMyVoteCopySettings(
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<VoteCopySettingDTO[]> {
    return (await this.voteCopyService.getMySettings(user.username)) as unknown as VoteCopySettingDTO[];
  }

  @Query(() => [VoteCopySettingDTO], {
    name: 'getWhoCopiesToMe',
    description: 'Кто копирует мои голоса',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getWhoCopiesToMe(
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<VoteCopySettingDTO[]> {
    return (await this.voteCopyService.getWhoCopiesToMe(user.username)) as unknown as VoteCopySettingDTO[];
  }

  @Query(() => [VoteCopySettingDTO], {
    name: 'getAllVoteCopySettings',
    description: 'Все настройки копирования голосов совета',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getAllVoteCopySettings(): Promise<VoteCopySettingDTO[]> {
    return (await this.voteCopyService.getAllSettings()) as unknown as VoteCopySettingDTO[];
  }

  @Mutation(() => VoteCopySettingDTO, {
    name: 'createVoteCopy',
    description: 'Настроить копирование голоса члена совета',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async createVoteCopy(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data') data: CreateVoteCopyInputDTO,
  ): Promise<VoteCopySettingDTO> {
    return (await this.voteCopyService.createSetting(
      user.username,
      data.source_username,
      data.decision_types || [],
    )) as unknown as VoteCopySettingDTO;
  }

  @Mutation(() => VoteCopySettingDTO, {
    name: 'deactivateVoteCopy',
    description: 'Деактивировать копирование голоса',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async deactivateVoteCopy(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('id', { type: () => String }) id: string,
  ): Promise<VoteCopySettingDTO> {
    return (await this.voteCopyService.deactivate(id, user.username)) as unknown as VoteCopySettingDTO;
  }

  @Mutation(() => Boolean, {
    name: 'deleteVoteCopy',
    description: 'Удалить настройку копирования',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async deleteVoteCopy(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    await this.voteCopyService.deleteSetting(id, user.username);
    return true;
  }
}
