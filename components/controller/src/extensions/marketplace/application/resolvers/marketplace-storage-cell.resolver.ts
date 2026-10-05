import { Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  GrantedScope,
  platformSettings,
  RequireRight,
  type IGrantedScope,
} from '@coopenomics/extension-kit';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import {
  MarketplaceCreateStorageCellInputDTO,
  MarketplaceCreateStorageGridInputDTO,
  MarketplaceListStorageCellsInputDTO,
  MarketplaceRenameStorageSectionInputDTO,
  MarketplaceRetireStorageCellsInputDTO,
  MarketplaceStorageCellDTO,
  MarketplaceUpdateStorageCellInputDTO,
  toMarketplaceStorageCellDTO,
} from '../dto/marketplace-storage-cell.dto';
import { MarketplaceStorageCellService } from '../services/marketplace-storage-cell.service';

@Resolver()
@Injectable()
export class MarketplaceStorageCellResolver {
  constructor(private readonly storageCellService: MarketplaceStorageCellService) {}

  @Query(() => [MarketplaceStorageCellDTO], {
    name: 'marketplaceListStorageCells',
    description: 'Ячейки хранения складов кооперативных участков.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('StorageCell', 'read:own-KU', { list: 'data.braname' })
  async marketplaceListStorageCells(
    @GrantedScope() scope: IGrantedScope,
    @Args('data', { nullable: true }) data?: MarketplaceListStorageCellsInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;
    // Участки отбора отдаёт гард: свои у оператора, запрошенный либо все — у
    // председателя (тогда отбора нет, и в запрос к базе уходит undefined).
    if (scope.kus && scope.kus.length === 0) return [];
    const cells = await this.storageCellService.list(coopname, scope.kus ?? undefined, {
      is_active: data?.is_active,
    });
    return cells.map(toMarketplaceStorageCellDTO);
  }

  @Mutation(() => MarketplaceStorageCellDTO, {
    name: 'marketplaceCreateStorageCell',
    description: 'Председатель кооперативного участка заводит ячейку хранения.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('StorageCell', 'manage:own-KU', { ku: 'data.braname' })
  async marketplaceCreateStorageCell(
    @Args('data') data: MarketplaceCreateStorageCellInputDTO
  ): Promise<MarketplaceStorageCellDTO> {
    const coopname = platformSettings().coopname;

    const cell = await this.storageCellService.createCell({
      coopname,
      braname: data.braname,
      section: data.section,
      level: data.level,
      label: data.label ?? null,
    });
    return toMarketplaceStorageCellDTO(cell);
  }

  @Mutation(() => [MarketplaceStorageCellDTO], {
    name: 'marketplaceCreateStorageGrid',
    description:
      'Председатель кооперативного участка заводит сетку ячеек «секции × ярусы» одним действием. Уже существующие адреса пропускаются.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('StorageCell', 'manage:own-KU', { ku: 'data.braname' })
  async marketplaceCreateStorageGrid(
    @Args('data') data: MarketplaceCreateStorageGridInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;

    const cells = await this.storageCellService.createGrid({
      coopname,
      braname: data.braname,
      sections: data.sections,
      level_from: data.level_from,
      level_to: data.level_to,
    });
    return cells.map(toMarketplaceStorageCellDTO);
  }

  @Mutation(() => MarketplaceStorageCellDTO, {
    name: 'marketplaceUpdateStorageCell',
    description:
      'Председатель кооперативного участка правит подпись ячейки или выводит её из оборота. Вывести можно только пустую ячейку.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('StorageCell', 'manage:own-KU', { of: 'StorageCell', id: 'data.cell_id' })
  async marketplaceUpdateStorageCell(
    @Args('data') data: MarketplaceUpdateStorageCellInputDTO
  ): Promise<MarketplaceStorageCellDTO> {
    const coopname = platformSettings().coopname;

    const updated = await this.storageCellService.update({
      coopname,
      id: data.cell_id,
      label: data.label,
      is_active: data.is_active,
    });
    return toMarketplaceStorageCellDTO(updated);
  }

  @Mutation(() => [MarketplaceStorageCellDTO], {
    name: 'marketplaceRenameStorageSection',
    description:
      'Председатель кооперативного участка переименовывает секцию склада целиком — вместе с адресами всех её ячеек.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('StorageCell', 'manage:own-KU', { ku: 'data.braname' })
  async marketplaceRenameStorageSection(
    @Args('data') data: MarketplaceRenameStorageSectionInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;

    const cells = await this.storageCellService.renameSection({
      coopname,
      braname: data.braname,
      section: data.section,
      new_section: data.new_section,
    });
    return cells.map(toMarketplaceStorageCellDTO);
  }

  @Mutation(() => [MarketplaceStorageCellDTO], {
    name: 'marketplaceRetireStorageCells',
    description:
      'Председатель кооперативного участка выводит из оборота секцию или ярус склада целиком. Выводится только пустая координата.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireRight('StorageCell', 'manage:own-KU', { ku: 'data.braname' })
  async marketplaceRetireStorageCells(
    @Args('data') data: MarketplaceRetireStorageCellsInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;

    const cells = await this.storageCellService.retireCells({
      coopname,
      braname: data.braname,
      section: data.section,
      level: data.level,
    });
    return cells.map(toMarketplaceStorageCellDTO);
  }
}
