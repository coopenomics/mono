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

// GraphQL-резолвер для marketplace-детализации существующих в core КУ.
// Доступ: операции записи — только chairman (админ кооператива);
// чтение — chairman, member, user. Фильтрация onlyActive для заказчика/
// поставщика выполняется на уровне UI.
@Resolver(() => KuDetailsDTO)
export class KuDetailsResolver {
  constructor(private readonly kuDetailsService: KuDetailsService) {}

  @Mutation(() => KuDetailsDTO, {
    name: 'marketplaceDetailKU',
    description:
      'Детализирует существующий в core кооперативный участок как ПВЗ Стола заказов. ' +
      'Создаёт запись marketplace_ku_details, либо обновляет существующую. ' +
      'При смене адреса запускает повторный геокодинг — координаты сбрасываются в PENDING ' +
      'и обновляются асинхронно.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async marketplaceDetailKU(@Args('data', { type: () => DetailKUInputDTO }) data: DetailKUInputDTO): Promise<KuDetailsDTO> {
    return this.kuDetailsService.detailKU(data);
  }

  @Mutation(() => KuDetailsDTO, {
    name: 'marketplaceSetKUStatus',
    description: 'Активирует или деактивирует ПВЗ Стола заказов.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async marketplaceSetKUStatus(@Args('data', { type: () => SetKUStatusInputDTO }) data: SetKUStatusInputDTO): Promise<KuDetailsDTO> {
    return this.kuDetailsService.setStatus(data);
  }

  @Mutation(() => KuDetailsDTO, {
    name: 'marketplaceRetryKUGeocode',
    description: 'Повторно запускает геокодинг адреса ПВЗ.',
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
    description: 'Список marketplace-детализаций ПВЗ кооператива.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async marketplaceListKUDetails(@Args('data', { type: () => ListMarketplaceKUInputDTO }) data: ListMarketplaceKUInputDTO): Promise<KuDetailsDTO[]> {
    return this.kuDetailsService.list(data);
  }
}
