import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  GrantedScope,
  platformSettings,
  RequireRight,
  SELF,
  RightsGuard,
  type IGrantedScope,
} from '@coopenomics/extension-kit';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
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
import { MarketplaceContainerService } from '../services/marketplace-container.service';

@Resolver()
@Injectable()
export class MarketplaceContainerResolver {
  constructor(private readonly containerService: MarketplaceContainerService) {}

  @Query(() => [MarketplaceContainerTypeDTO], {
    name: 'marketplaceListContainerTypes',
    description: 'Справочник типов боксов кооператива: габариты и объём.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Container', 'read:own-KU', SELF)
  async marketplaceListContainerTypes(
    @Args('is_active', { nullable: true }) is_active?: boolean
  ): Promise<MarketplaceContainerTypeDTO[]> {
    const types = await this.containerService.listTypes(platformSettings().coopname, is_active);
    return types.map(toMarketplaceContainerTypeDTO);
  }

  @Mutation(() => MarketplaceContainerTypeDTO, {
    name: 'marketplaceCreateContainerType',
    description: 'Заведение типа боксов с габаритами и объёмом.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  // Типы тары — общий справочник кооператива: габариты одинаковы на всех
  // участках, а по объёму считается перевозка боксов между ними. Заводит их
  // председатель на своём столе; участок берёт готовый тип при заведении боксов.
  @RequireRight('Container', 'manage:types')
  async marketplaceCreateContainerType(
    @Args('data') data: MarketplaceCreateContainerTypeInputDTO
  ): Promise<MarketplaceContainerTypeDTO> {
    const type = await this.containerService.createType({
      coopname: platformSettings().coopname,
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Container', 'read:own-KU', { list: 'data.braname' })
  async marketplaceListContainers(
    @GrantedScope() scope: IGrantedScope,
    @Args('data', { nullable: true }) data?: MarketplaceListContainersInputDTO
  ): Promise<MarketplaceContainerDTO[]> {
    const coopname = platformSettings().coopname;
    // Участки отбора отдаёт гард: свои у оператора, запрошенный либо все — у
    // председателя (тогда отбора нет, и в запрос к базе уходит undefined).
    if (scope.kus && scope.kus.length === 0) return [];
    const containers = await this.containerService.list(coopname, scope.kus ?? undefined, {
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Container', 'read:own-KU', { of: 'ContainerCode', id: 'data.code' })
  async marketplaceResolveContainerByCode(
    @Args('data') data: MarketplaceResolveContainerByCodeInputDTO
  ): Promise<MarketplaceContainerDTO> {
    const container = await this.containerService.getByCode(platformSettings().coopname, data.code);
    return toMarketplaceContainerDTO(container);
  }

  @Mutation(() => [MarketplaceContainerDTO], {
    name: 'marketplaceCreateContainers',
    description:
      'Председатель кооперативного участка заводит партию боксов одного типа; коды выдаются последовательно.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Container', 'manage:own-KU', { ku: 'data.braname' })
  async marketplaceCreateContainers(
    @Args('data') data: MarketplaceCreateContainersInputDTO
  ): Promise<MarketplaceContainerDTO[]> {
    const coopname = platformSettings().coopname;
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Container', 'manage:own-KU', { of: 'Container', id: 'data.container_id' })
  async marketplaceMoveContainer(
    @Args('data') data: MarketplaceMoveContainerInputDTO
  ): Promise<MarketplaceContainerDTO> {
    const coopname = platformSettings().coopname;
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
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, RightsGuard)
  @RequireRight('Container', 'manage:own-KU', { of: 'Container', id: 'data.container_id' })
  async marketplaceUpdateContainer(
    @Args('data') data: MarketplaceUpdateContainerInputDTO
  ): Promise<MarketplaceContainerDTO> {
    const coopname = platformSettings().coopname;
    const updated = await this.containerService.update({
      coopname,
      container_id: data.container_id,
      label: data.label,
      is_active: data.is_active,
    });
    return toMarketplaceContainerDTO(updated);
  }
}
