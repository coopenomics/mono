import { ForbiddenException, Inject, Injectable, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { MarketplaceSupplierDTO } from '../dto/marketplace-supplier.dto';
import {
  MarketplaceAddSupplierInputDTO,
  MarketplaceRequestSupplierInputDTO,
  MarketplaceSupplierMemberInputDTO,
  MarketplaceSwitchSupplierModelInputDTO,
} from '../dto/marketplace-supplier-input.dto';
import { MarketplaceSupplierModel } from '../../domain/entities/marketplace-supplier.types';
import {
  MARKETPLACE_SUPPLIER_REGISTRY_SERVICE,
  MarketplaceSupplierRegistryService,
} from '../services/marketplace-supplier-registry.service';

/**
 * Реестр поставщиков «Стола заказов».
 *
 * Два пути допуска:
 *   - путь 1 (пайщик): `marketplaceRequestSupplier` — заявка по членской
 *     модели, запись `PENDING`, ждёт одобрения председателем;
 *   - путь 2 (администратор): `marketplaceAddSupplier` — прямое добавление,
 *     запись сразу `APPROVED`.
 *
 * Одобрение/отклонение заявок (`approve`/`reject`) — действие председателя:
 * стол администратора доступен администраторам, но не каждый администратор —
 * председатель, поэтому здесь дополнительно проверяется Chairman-роль.
 */
@Resolver()
@Injectable()
export class MarketplaceSupplierResolver {
  constructor(
    @Inject(MARKETPLACE_SUPPLIER_REGISTRY_SERVICE)
    private readonly service: MarketplaceSupplierRegistryService
  ) {}

  @Query(() => [MarketplaceSupplierDTO], {
    name: 'marketplaceListSuppliers',
    description: 'Реестр поставщиков кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Supplier', 'manage')
  async marketplaceListSuppliers(): Promise<MarketplaceSupplierDTO[]> {
    const entries = await this.service.list(config.coopname);
    return entries.map((e) => MarketplaceSupplierDTO.fromDomain(e));
  }

  @Query(() => MarketplaceSupplierDTO, {
    name: 'marketplaceMySupplierState',
    nullable: true,
    description: 'Запись текущего пайщика в реестре поставщиков (для онбординга)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceMySupplierState(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): Promise<MarketplaceSupplierDTO | null> {
    const entry = await this.service.findByMember(config.coopname, currentMember.username);
    return entry ? MarketplaceSupplierDTO.fromDomain(entry) : null;
  }

  @Mutation(() => MarketplaceSupplierDTO, {
    name: 'marketplaceRequestSupplier',
    description: 'Подать заявку на допуск поставщика по членской модели (путь 1)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceRequestSupplier(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceRequestSupplierInputDTO
  ): Promise<MarketplaceSupplierDTO> {
    const entry = await this.service.requestMembership(
      config.coopname,
      currentMember.username,
      input.contract_number,
      input.contract_date
    );
    return MarketplaceSupplierDTO.fromDomain(entry);
  }

  @Mutation(() => MarketplaceSupplierDTO, {
    name: 'marketplaceSwitchSupplierModel',
    description: 'Сменить модель работы поставщика (требует переподписания договора)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceSwitchSupplierModel(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSwitchSupplierModelInputDTO
  ): Promise<MarketplaceSupplierDTO> {
    const entry = await this.service.switchModel(
      config.coopname,
      currentMember.username,
      input.model,
      input.contract_number ?? null,
      input.contract_date ?? null
    );
    return MarketplaceSupplierDTO.fromDomain(entry);
  }

  @Mutation(() => MarketplaceSupplierDTO, {
    name: 'marketplaceAddSupplier',
    description: 'Добавить поставщика в реестр напрямую с одобрением (путь 2, администратор)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Supplier', 'manage')
  async marketplaceAddSupplier(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceAddSupplierInputDTO
  ): Promise<MarketplaceSupplierDTO> {
    const entry = await this.service.addSupplier(
      config.coopname,
      input.member_account,
      input.model ?? MarketplaceSupplierModel.MEMBERSHIP,
      input.contract_number ?? null,
      input.contract_date ?? null,
      currentMember.username
    );
    return MarketplaceSupplierDTO.fromDomain(entry);
  }

  @Mutation(() => MarketplaceSupplierDTO, {
    name: 'marketplaceApproveSupplier',
    description: 'Одобрить заявку поставщика (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Supplier', 'manage')
  async marketplaceApproveSupplier(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSupplierMemberInputDTO
  ): Promise<MarketplaceSupplierDTO> {
    this.assertChairman(currentMember);
    const entry = await this.service.approve(
      config.coopname,
      input.member_account,
      currentMember.username
    );
    return MarketplaceSupplierDTO.fromDomain(entry);
  }

  @Mutation(() => MarketplaceSupplierDTO, {
    name: 'marketplaceRejectSupplier',
    description: 'Отклонить заявку поставщика (председатель)',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Supplier', 'manage')
  async marketplaceRejectSupplier(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember,
    @Args('input') input: MarketplaceSupplierMemberInputDTO
  ): Promise<MarketplaceSupplierDTO> {
    this.assertChairman(currentMember);
    const entry = await this.service.reject(
      config.coopname,
      input.member_account,
      currentMember.username
    );
    return MarketplaceSupplierDTO.fromDomain(entry);
  }

  /**
   * Одобрение/отклонение поставщиков — прерогатива председателя. Стол
   * администратора могут видеть администраторы без роли председателя, поэтому
   * проверяем Chairman-роль явно поверх admin-гейта `Supplier:manage`.
   */
  private assertChairman(currentMember: IMarketplaceCurrentMember): void {
    if (!currentMember.core_roles.includes('Chairman')) {
      throw new ForbiddenException(
        'Одобрять и отклонять заявки поставщиков может только председатель кооператива.'
      );
    }
  }
}
