import { ForbiddenException, Inject, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import { RequireMarketplaceAccess } from '../decorators/marketplace-access.decorator';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { MarketplaceRoleGuard } from '../guards/marketplace-role.guard';
import { canAccess } from '../access/marketplace-access-matrix';
import type { MarketplaceRole } from '../membership/marketplace-roles.mapper';
import {
  MARKETPLACE_KU_CHAIRMAN_SERVICE,
  type MarketplaceKuChairmanService,
} from '../services/marketplace-ku-chairman.service';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceCreateShipmentInputDTO,
  MarketplaceCreateShipmentResultDTO,
  MarketplaceGetShipmentInputDTO,
  MarketplaceListShipmentsByBranameInputDTO,
  MarketplaceListShipmentsInputDTO,
  MarketplaceShipmentDTO,
  toMarketplaceShipmentDTO,
} from '../dto/marketplace-shipment.dto';
import {
  MARKETPLACE_SHIPMENT_CREATE_SERVICE,
  MarketplaceShipmentCreateService,
} from '../services/marketplace-shipment-create.service';
import {
  MARKETPLACE_SHIPMENT_REPOSITORY,
  type MarketplaceShipmentDomainRepository,
  type MarketplaceShipmentListFilter,
} from '../../domain/repositories/marketplace-shipment.repository';
import type {
  MarketplaceShipmentDeliveryVariant,
  MarketplaceShipmentStatus,
  MarketplaceShipmentTTNData,
} from '../../domain/entities/marketplace-shipment.types';

@Resolver()
@Injectable()
export class MarketplaceShipmentResolver {
  constructor(
    @Inject(MARKETPLACE_SHIPMENT_CREATE_SERVICE)
    private readonly createService: MarketplaceShipmentCreateService,
    @Inject(MARKETPLACE_SHIPMENT_REPOSITORY)
    private readonly shipmentRepo: MarketplaceShipmentDomainRepository,
    @Inject(MARKETPLACE_KU_CHAIRMAN_SERVICE)
    private readonly kuChairmanService: MarketplaceKuChairmanService
  ) {}

  @Mutation(() => MarketplaceCreateShipmentResultDTO, {
    name: 'marketplaceCreateShipment',
    description:
      'Сформировать партии поставки из акцептованной заявки. Каждая группа = одна партия ' +
      '(КУ + вариант доставки + опционально подмножество заказов). Покрытие всех КУ не ' +
      'обязательно — допустима частичная отгрузка и догрузка остатка отдельными партиями.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceCreateShipment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceCreateShipmentInputDTO
  ): Promise<MarketplaceCreateShipmentResultDTO> {
    const result = await this.createService.execute({
      coopname: config.coopname,
      offerer_account: member.username,
      cycle_id: data.cycle_id,
      groups: data.groups.map((g) => ({
        braname: g.braname,
        delivery_variant: g.delivery_variant as unknown as MarketplaceShipmentDeliveryVariant,
        ttn_data: (g.ttn_data ?? null) as MarketplaceShipmentTTNData | null,
        order_ids: g.order_ids ?? null,
      })),
    });

    const dto = new MarketplaceCreateShipmentResultDTO();
    dto.shipments = result.shipments.map(toMarketplaceShipmentDTO);
    return dto;
  }

  @Query(() => [MarketplaceShipmentDTO], {
    name: 'marketplaceListShipments',
    description:
      'Список партий поставки текущего поставщика — для стола подготовки поставки и истории.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceListShipments(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data', { nullable: true }) data?: MarketplaceListShipmentsInputDTO
  ): Promise<MarketplaceShipmentDTO[]> {
    const filter: MarketplaceShipmentListFilter = {
      coopname: config.coopname,
      offerer_account: member.username,
      cycle_id: data?.cycle_id,
      braname: data?.braname,
      status: data?.statuses?.length
        ? (data.statuses as MarketplaceShipmentStatus[])
        : undefined,
    };
    const list = await this.shipmentRepo.list(filter);
    return list.map(toMarketplaceShipmentDTO);
  }

  @Query(() => [MarketplaceShipmentDTO], {
    name: 'marketplaceListShipmentsByBraname',
    description:
      'Список партий поставки, ожидаемых на кооперативном участке, — для стола приёмки оператора пункта выдачи.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Shipment', 'read:own-KU')
  async marketplaceListShipmentsByBraname(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceListShipmentsByBranameInputDTO
  ): Promise<MarketplaceShipmentDTO[]> {
    const coopname = config.coopname;
    const roles = member.marketplace_roles as MarketplaceRole[];

    // Ownership-фильтрация — ответственность резолвера (matrix даёт только
    // capability). Роль с `Shipment:read:all` видит партии любого КУ; роль
    // только с `read:own-KU` (оператор/председатель КУ) обязана быть членом
    // запрашиваемого участка, иначе утечёт лента поставок чужого КУ.
    if (!canAccess(roles, 'Shipment', 'read:all')) {
      const isMember = await this.kuChairmanService.isMemberOfBranch(
        coopname,
        data.braname,
        member.username
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Лента поставок доступна только по участку, на котором вы являетесь председателем или доверенным лицом.'
        );
      }
    }

    const filter: MarketplaceShipmentListFilter = {
      coopname,
      braname: data.braname,
      status: data.statuses?.length
        ? (data.statuses as MarketplaceShipmentStatus[])
        : undefined,
    };
    const list = await this.shipmentRepo.list(filter);
    return list.map(toMarketplaceShipmentDTO);
  }

  @Query(() => MarketplaceShipmentDTO, {
    name: 'marketplaceGetShipment',
    description: 'Получить партию поставки по идентификатору.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard, MarketplaceRoleGuard)
  @RequireMarketplaceAccess('Shipment', 'create:own')
  async marketplaceGetShipment(
    @CurrentMarketplaceMember() member: IMarketplaceCurrentMember,
    @Args('data') data: MarketplaceGetShipmentInputDTO
  ): Promise<MarketplaceShipmentDTO> {
    const shipment = await this.shipmentRepo.findById(data.shipment_id);
    if (!shipment || shipment.coopname !== config.coopname) {
      throw new NotFoundException('Партия поставки не найдена.');
    }
    if (shipment.offerer_account !== member.username) {
      throw new NotFoundException('Партия поставки не найдена.');
    }
    return toMarketplaceShipmentDTO(shipment);
  }
}
