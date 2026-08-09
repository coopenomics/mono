import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceContainerDTO,
  MarketplaceContainerTypeDTO,
  MarketplaceCreateContainersInputDTO,
  MarketplaceCreateContainerTypeInputDTO,
  MarketplaceListContainersInputDTO,
  MarketplaceMoveContainerInputDTO,
  MarketplaceResolveContainerByCodeInputDTO,
  MarketplaceUpdateContainerInputDTO,
  toMarketplaceContainerDTO,
  toMarketplaceContainerTypeDTO,
} from '../dto/marketplace-container.dto';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import { MarketplaceContainerService } from '../services/marketplace-container.service';

@Resolver()
@Injectable()
export class MarketplaceContainerResolver {
  constructor(
    private readonly containerService: MarketplaceContainerService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  @Query(() => [MarketplaceContainerTypeDTO], {
    name: 'marketplaceListContainerTypes',
    description: 'Справочник типов боксов кооператива: габариты и объём.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'read:own-KU')
  async marketplaceListContainerTypes(
    @Args('is_active', { nullable: true }) is_active?: boolean
  ): Promise<MarketplaceContainerTypeDTO[]> {
    const types = await this.containerService.listTypes(config.coopname, is_active);
    return types.map(toMarketplaceContainerTypeDTO);
  }

  @Mutation(() => MarketplaceContainerTypeDTO, {
    name: 'marketplaceCreateContainerType',
    description: 'Заведение типа боксов с габаритами и объёмом.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'manage:own-KU')
  async marketplaceCreateContainerType(
    @Args('data') data: MarketplaceCreateContainerTypeInputDTO
  ): Promise<MarketplaceContainerTypeDTO> {
    const type = await this.containerService.createType({
      coopname: config.coopname,
      name: data.name,
      length_cm: data.length_cm,
      width_cm: data.width_cm,
      height_cm: data.height_cm,
      volume_m3: data.volume_m3 ?? null,
      max_weight_kg: data.max_weight_kg ?? null,
    });
    return toMarketplaceContainerTypeDTO(type);
  }

  @Query(() => [MarketplaceContainerDTO], {
    name: 'marketplaceListContainers',
    description: 'Боксы кооперативных участков.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'read:own-KU')
  async marketplaceListContainers(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListContainersInputDTO
  ): Promise<MarketplaceContainerDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    let branameFilter: string | string[] | undefined = data?.braname;
    if (!canAccess(roles, 'Container', 'read:all')) {
      const own = await this.resolveOwnBranames(coopname, member.username, data?.braname);
      if (own === null) return [];
      branameFilter = own;
    }

    const containers = await this.containerService.list(coopname, branameFilter ?? [], {
      is_active: data?.is_active,
      container_type_id: data?.container_type_id,
      unplaced_only: data?.unplaced_only,
    });
    return containers.map(toMarketplaceContainerDTO);
  }

  @Query(() => MarketplaceContainerDTO, {
    name: 'marketplaceResolveContainerByCode',
    description: 'Бокс по коду с этикетки или отсканированного QR.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'read:own-KU')
  async marketplaceResolveContainerByCode(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceResolveContainerByCodeInputDTO
  ): Promise<MarketplaceContainerDTO> {
    const coopname = config.coopname;
    const container = await this.containerService.getByCode(coopname, data.code);

    const roles = member.marketplace_roles as MarketplaceRole[];
    if (!canAccess(roles, 'Container', 'read:all')) {
      await this.kuChairmanService.assertIsMemberOfBranch(
        coopname,
        container.braname,
        member.username
      );
    }
    return toMarketplaceContainerDTO(container);
  }

  @Mutation(() => [MarketplaceContainerDTO], {
    name: 'marketplaceCreateContainers',
    description:
      'Председатель кооперативного участка заводит партию боксов одного типа; коды выдаются последовательно.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'manage:own-KU')
  async marketplaceCreateContainers(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateContainersInputDTO
  ): Promise<MarketplaceContainerDTO[]> {
    const coopname = config.coopname;
    await this.kuChairmanService.assertIsMemberOfBranch(coopname, data.braname, member.username);

    const containers = await this.containerService.createContainers({
      coopname,
      braname: data.braname,
      container_type_id: data.container_type_id,
      count: data.count,
      label: data.label ?? null,
    });
    return containers.map(toMarketplaceContainerDTO);
  }

  @Mutation(() => MarketplaceContainerDTO, {
    name: 'marketplaceMoveContainer',
    description:
      'Председатель кооперативного участка ставит бокс в ячейку или снимает с адреса. Бокс без адреса — допустимое состояние.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'manage:own-KU')
  async marketplaceMoveContainer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceMoveContainerInputDTO
  ): Promise<MarketplaceContainerDTO> {
    const coopname = config.coopname;
    const container = await this.containerService.getById(coopname, data.container_id);
    await this.kuChairmanService.assertIsMemberOfBranch(
      coopname,
      container.braname,
      member.username
    );

    const moved = await this.containerService.moveToCell({
      coopname,
      container_id: data.container_id,
      cell_id: data.cell_id ?? null,
    });
    return toMarketplaceContainerDTO(moved);
  }

  @Mutation(() => MarketplaceContainerDTO, {
    name: 'marketplaceUpdateContainer',
    description:
      'Председатель кооперативного участка правит подпись бокса или выводит его из оборота. Вывести можно только пустой бокс.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Container', 'manage:own-KU')
  async marketplaceUpdateContainer(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceUpdateContainerInputDTO
  ): Promise<MarketplaceContainerDTO> {
    const coopname = config.coopname;
    const container = await this.containerService.getById(coopname, data.container_id);
    await this.kuChairmanService.assertIsMemberOfBranch(
      coopname,
      container.braname,
      member.username
    );

    const updated = await this.containerService.update({
      coopname,
      container_id: data.container_id,
      label: data.label,
      is_active: data.is_active,
    });
    return toMarketplaceContainerDTO(updated);
  }

  private async resolveOwnBranames(
    coopname: string,
    username: string,
    requested?: string
  ): Promise<string | string[] | null> {
    const own = await this.kuChairmanService.listBranamesForMember(coopname, username);
    if (own.length === 0) return null;
    if (requested) {
      if (!own.includes(requested)) {
        throw new ForbiddenException(
          'Боксы доступны только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
      return requested;
    }
    return own;
  }
}
