import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { DetailKUInputDTO } from '../dto/detail-ku-input.dto';
import { SetKUStatusInputDTO } from '../dto/deactivate-ku-input.dto';
import { KuDetailsDTO } from '../dto/ku-details.dto';
import { ListMarketplaceKUInputDTO } from '../dto/list-marketplace-ku-input.dto';
import { KuDetailsService } from '../services/ku-details.service';

/**
 * GraphQL-резолвер для marketplace-детализации существующих в core КУ
 * (Эпик 2, Stories 2.1 + 2.2).
 *
 * Доступ: операции записи — только `chairman` (общий админ кооператива,
 * marketplace-role `[admin]` per Story 1.6/1.8 локального acceptance);
 * чтение — `chairman`, `member` (member ≈ `board_readonly`), `user`
 * (заказчик/поставщик), однако заказчику/поставщику резолвер на их столе
 * фильтрует `onlyActive=true` на уровне UI — см. Story 2.3.
 */
@Resolver(() => KuDetailsDTO)
export class KuDetailsResolver {
  constructor(private readonly kuDetailsService: KuDetailsService) {}

  @Mutation(() => KuDetailsDTO, {
    name: 'marketplaceDetailKU',
    description:
      'Детализирует существующий в core кооперативный участок как ПВЗ Стола заказов (Story 2.1). ' +
      'Создаёт запись `marketplace_ku_details`, либо обновляет существующую. ' +
      'При смене адреса запускает повторный геокодинг Yandex (Story 2.2) — координаты ' +
      'сбрасываются в `PENDING` и обновляются асинхронно.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async marketplaceDetailKU(@Args('data', { type: () => DetailKUInputDTO }) data: DetailKUInputDTO): Promise<KuDetailsDTO> {
    return this.kuDetailsService.detailKU(data);
  }

  @Mutation(() => KuDetailsDTO, {
    name: 'marketplaceSetKUStatus',
    description: 'Активирует или деактивирует ПВЗ Стола заказов (Story 2.1).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async marketplaceSetKUStatus(@Args('data', { type: () => SetKUStatusInputDTO }) data: SetKUStatusInputDTO): Promise<KuDetailsDTO> {
    return this.kuDetailsService.setStatus(data);
  }

  @Mutation(() => KuDetailsDTO, {
    name: 'marketplaceRetryKUGeocode',
    description: 'Повторно запускает геокодинг адреса ПВЗ (Story 2.2, re-trigger).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async marketplaceRetryKUGeocode(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('coreBraname', { type: () => String }) coreBraname: string
  ): Promise<KuDetailsDTO> {
    return this.kuDetailsService.retryGeocode(coopname, coreBraname);
  }

  @Query(() => [KuDetailsDTO], {
    name: 'marketplaceListKUDetails',
    description: 'Список marketplace-детализаций ПВЗ кооператива (Story 2.1).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async marketplaceListKUDetails(@Args('data', { type: () => ListMarketplaceKUInputDTO }) data: ListMarketplaceKUInputDTO): Promise<KuDetailsDTO[]> {
    return this.kuDetailsService.list(data);
  }
}
