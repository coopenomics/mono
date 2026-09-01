import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import { CapabilitySetService } from './capability-set.service';
import { AuthorizationGuard } from './authorization.guard';
import { CheckAbility } from './check-ability.decorator';
import {
  AssignCapabilitySetInputDTO,
  CapabilitySetAssignmentDTO,
  CapabilitySetDTO,
  ParticipantAccessDTO,
  RevokeCapabilitySetInputDTO,
} from './dto/capability-set.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role?: string;
}

/**
 * GraphQL-фасад назначаемых наборов возможностей и эффективного доступа (Story 6.11).
 * Заменяет REST-контроллеры `coop/capability-sets` и `coop/access` — фронт ходит через
 * @coopenomics/sdk (Zeus), нового способа взаимодействия с бэкендом наружу не появляется.
 *
 * Авторизация — тот же субстрат Эпика 6: `@CheckAbility` + `AuthorizationGuard` (уже
 * GraphQL-aware). Председатель управляет наборами (`manage CapabilitySet`), читает каталог
 * (`read`); `getMyAccess` — собственный доступ текущего пайщика (без CASL-требования).
 */
@Resolver()
export class AuthorizationResolver {
  constructor(private readonly service: CapabilitySetService) {}

  @Query(() => [CapabilitySetDTO], {
    name: 'getCapabilitySets',
    description: 'Каталог наборов возможностей с правами, которые они открывают',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('read', 'CapabilitySet')
  async getCapabilitySets(): Promise<CapabilitySetDTO[]> {
    const sets = await this.service.listSets();
    return sets.map((s) => ({
      set_key: s.setKey,
      title: s.title,
      description: s.description,
      builtin: s.builtin,
      coopname: s.coopname,
      grants: s.grants.map((g) => ({ action: g.action, resource: g.resource })),
    }));
  }

  @Query(() => [CapabilitySetAssignmentDTO], {
    name: 'getParticipantCapabilitySets',
    description: 'Активные наборы возможностей, назначенные пайщику',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('read', 'CapabilitySet')
  async getParticipantCapabilitySets(
    @Args('username', { type: () => String }) username: string,
  ): Promise<CapabilitySetAssignmentDTO[]> {
    const assignments = await this.service.listForParticipant(username);
    return assignments.map((a) => ({
      username: a.username,
      set_key: a.setKey,
      granted_by: a.grantedBy,
      granted_at: a.grantedAt,
      expires_at: a.expiresAt,
    }));
  }

  @Query(() => ParticipantAccessDTO, {
    name: 'getMyAccess',
    description: 'Эффективный доступ текущего пайщика (основание гейтинга столов и страниц)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMyAccess(@CurrentUser() user: ICurrentUser): Promise<ParticipantAccessDTO> {
    const access = await this.service.getMyAccess({ username: user.username, role: user.role });
    return {
      sets: access.sets,
      grants: access.grants.map((g) => ({ action: g.action, resource: g.resource })),
    };
  }

  @Mutation(() => Boolean, {
    name: 'assignCapabilitySet',
    description: 'Назначить пайщику набор возможностей (управляет председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('manage', 'CapabilitySet')
  async assignCapabilitySet(
    @Args('data', { type: () => AssignCapabilitySetInputDTO }) data: AssignCapabilitySetInputDTO,
    @CurrentUser() user: ICurrentUser,
  ): Promise<boolean> {
    await this.service.assign({
      username: data.username,
      setKey: data.set_key,
      grantedBy: user.username,
      expiresAt: data.expires_at ?? null,
    });
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'revokeCapabilitySet',
    description: 'Отозвать у пайщика набор возможностей (управляет председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, AuthorizationGuard)
  @CheckAbility('manage', 'CapabilitySet')
  async revokeCapabilitySet(
    @Args('data', { type: () => RevokeCapabilitySetInputDTO }) data: RevokeCapabilitySetInputDTO,
    @CurrentUser() user: ICurrentUser,
  ): Promise<boolean> {
    await this.service.revoke(data.username, data.set_key, user.username);
    return true;
  }
}
