import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { canAccess } from '../access/marketplace-access-matrix';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
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
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import { MarketplaceStorageCellService } from '../services/marketplace-storage-cell.service';

@Resolver()
@Injectable()
export class MarketplaceStorageCellResolver {
  constructor(
    private readonly storageCellService: MarketplaceStorageCellService,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  @Query(() => [MarketplaceStorageCellDTO], {
    name: 'marketplaceListStorageCells',
    description: 'Ячейки хранения складов кооперативных участков.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StorageCell', 'read:own-KU')
  async marketplaceListStorageCells(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListStorageCellsInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    let branameFilter: string | string[] | undefined = data?.braname;
    if (!canAccess(roles, 'StorageCell', 'read:all')) {
      const ownBranames = await this.resolveOwnBranames(coopname, member.username, data?.braname);
      if (ownBranames === null) return [];
      branameFilter = ownBranames;
    }

    const cells = await this.storageCellService.list(coopname, branameFilter ?? [], {
      is_active: data?.is_active,
    });
    return cells.map(toMarketplaceStorageCellDTO);
  }

  @Mutation(() => MarketplaceStorageCellDTO, {
    name: 'marketplaceCreateStorageCell',
    description: 'Председатель кооперативного участка заводит ячейку хранения.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('StorageCell', 'manage:own-KU')
  async marketplaceCreateStorageCell(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateStorageCellInputDTO
  ): Promise<MarketplaceStorageCellDTO> {
    const coopname = platformSettings().coopname;
    await this.assertManagesBranch(coopname, member.username, data.braname);

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
  @RequireMarketplaceAccess('StorageCell', 'manage:own-KU')
  async marketplaceCreateStorageGrid(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateStorageGridInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;
    await this.assertManagesBranch(coopname, member.username, data.braname);

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
  @RequireMarketplaceAccess('StorageCell', 'manage:own-KU')
  async marketplaceUpdateStorageCell(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceUpdateStorageCellInputDTO
  ): Promise<MarketplaceStorageCellDTO> {
    const coopname = platformSettings().coopname;
    const existing = await this.storageCellService.getById(coopname, data.cell_id);
    await this.assertManagesBranch(coopname, member.username, existing.braname);

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
  @RequireMarketplaceAccess('StorageCell', 'manage:own-KU')
  async marketplaceRenameStorageSection(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRenameStorageSectionInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;
    await this.assertManagesBranch(coopname, member.username, data.braname);

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
  @RequireMarketplaceAccess('StorageCell', 'manage:own-KU')
  async marketplaceRetireStorageCells(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceRetireStorageCellsInputDTO
  ): Promise<MarketplaceStorageCellDTO[]> {
    const coopname = platformSettings().coopname;
    await this.assertManagesBranch(coopname, member.username, data.braname);

    const cells = await this.storageCellService.retireCells({
      coopname,
      braname: data.braname,
      section: data.section,
      level: data.level,
    });
    return cells.map(toMarketplaceStorageCellDTO);
  }

  /**
   * Участки пайщика с поправкой на запрошенный фильтр. `null` — пайщик не
   * ведёт ни одного участка, отдавать нечего.
   */
  private async resolveOwnBranames(
    coopname: string,
    username: string,
    requested?: string
  ): Promise<string | string[] | null> {
    const ownBranames = await this.kuChairmanService.listBranamesForMember(coopname, username);
    if (ownBranames.length === 0) return null;
    if (requested) {
      if (!ownBranames.includes(requested)) {
        throw new ForbiddenException(
          'Склад доступен только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
      return requested;
    }
    return ownBranames;
  }

  private async assertManagesBranch(
    coopname: string,
    username: string,
    braname: string
  ): Promise<void> {
    await this.kuChairmanService.assertIsMemberOfBranch(coopname, braname, username);
  }
}
