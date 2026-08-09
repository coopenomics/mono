import { Resolver, Mutation, Query, Args, Int } from '@nestjs/graphql';
import { Injectable, Inject, UseGuards } from '@nestjs/common';
import { RequestDomainService, REQUEST_DOMAIN_SERVICE } from '../../domain/services/request-domain.service';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { RolesGuard, AuthRoles, GqlJwtAuthGuard, CurrentUser } from '@coopenomics/extension-kit';
import { RequestDTO } from '../dto/request.dto';
import { CreateRequestInput, RequestTypeInput, RequestImageTypeInput } from '../dto/create-request-input.dto';
import { GetCoopRequestsInput } from '../dto/get-coop-requests-input.dto';
import { GetRequestStatisticsInput } from '../dto/get-request-statistics-input.dto';
import { RequestStatisticsDTO } from '../dto/request-statistics.dto';
import { SearchRequestsInput } from '../dto/search-requests-input.dto';
import { GetUserRequestsInput } from '../dto/get-user-requests-input.dto';
import { FindPotentialMatchesInput } from '../dto/find-potential-matches-input.dto';
import { PublishRequestInput } from '../dto/publish-request-input.dto';
import { GetRequestInput } from '../dto/get-request-input.dto';
import { GetRequestByHashInput } from '../dto/get-request-by-hash-input.dto';
import { RequestType, RequestStatus } from '../../domain/entities/request-domain.entity';
import { RequestImageType } from '../../domain/entities/request-image-domain.entity';
import type { IMonoAccount } from '@coopenomics/innercoop';

/**
 * GraphQL resolver для работы с заявками marketplace.
 *
 * Доступ — пайщикам кооператива (через `MarketplaceMembershipGuard`).
 * Story 1.3 / 1.8: заявки — закрытый ресурс marketplace, не публичный.
 */
@Resolver(() => RequestDTO)
@UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
@Injectable()
export class RequestResolver {
  constructor(
    @Inject(REQUEST_DOMAIN_SERVICE)
    private readonly requestService: RequestDomainService
  ) {}

  /**
   * Создать новую заявку
   */
  @Mutation(() => RequestDTO, {
    name: 'marketplaceCreateRequest',
    description: 'Создать новую заявку на поставку или заказ товара',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async createRequest(
    @Args('data', { type: () => CreateRequestInput })
    data: CreateRequestInput,
    @CurrentUser() user: IMonoAccount
  ): Promise<RequestDTO> {
    // Преобразуем входные данные в параметры для доменного сервиса
    const requestParams = {
      coopname: data.coopname,
      username: user.username,
      type: this.convertRequestType(data.type),
      name: data.name,
      articleNumber: data.articleNumber,
      descriptionCategoryId: data.descriptionCategoryId,
      typeId: data.typeId,
      price: data.price,
      currencyCode: data.currencyCode || 'RUB',
      vat: data.vat,
      units: data.units,
      barcode: data.barcode,
      oldPrice: data.oldPrice,
      width: data.width,
      height: data.height,
      depth: data.depth,
      dimensionUnit: data.dimensionUnit || 'mm',
      weight: data.weight,
      weightUnit: data.weightUnit || 'g',
      productLifecycleSecs: data.productLifecycleSecs,
      warrantyDays: data.warrantyDays,
      data: data.data,
      meta: data.meta,
      attributes: data.attributes.map((attr) => ({
        attributeId: attr.attributeId,
        value: attr.value,
        complexId: attr.complexId || 0,
        dictionaryValueId: attr.dictionaryValueId,
      })),
      images: data.images.map((img) => ({
        imageUrl: img.imageUrl,
        imageType: this.convertImageType(img.imageType),
        sortOrder: img.sortOrder,
        description: img.description,
      })),
      primaryImageUrl: data.primaryImageUrl,
      colorImageUrl: data.colorImageUrl,
      geoNames: data.geoNames || [],
      parentHash: data.parentHash,
    };

    const request = await this.requestService.createRequest(requestParams);
    return RequestDTO.fromDomain(request);
  }

  /**
   * Получить заявку по ID
   */
  @Query(() => RequestDTO, {
    name: 'marketplaceGetRequest',
    description: 'Получить заявку по ID',
    nullable: true,
  })
  async getRequest(
    @Args('data', { type: () => GetRequestInput })
    data: GetRequestInput
  ): Promise<RequestDTO | null> {
    const request = await this.requestService.findById(data.id);
    return request ? RequestDTO.fromDomain(request) : null;
  }

  /**
   * Получить заявку по хэшу
   */
  @Query(() => RequestDTO, {
    name: 'marketplaceGetRequestByHash',
    description: 'Получить заявку по хэшу',
    nullable: true,
  })
  async getRequestByHash(
    @Args('data', { type: () => GetRequestByHashInput })
    data: GetRequestByHashInput
  ): Promise<RequestDTO | null> {
    const request = await this.requestService.findByHash(data.hash);
    return request ? RequestDTO.fromDomain(request) : null;
  }

  /**
   * Получить заявки пользователя
   */
  @Query(() => [RequestDTO], {
    name: 'marketplaceGetUserRequests',
    description: 'Получить заявки текущего пользователя',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getUserRequests(
    @CurrentUser() user: IMonoAccount,
    @Args('data', { type: () => GetUserRequestsInput, nullable: true })
    data?: GetUserRequestsInput
  ): Promise<RequestDTO[]> {
    const requests = await this.requestService.findRecentByUser(user.username, data?.limit);
    return requests.map((req) => RequestDTO.fromDomain(req));
  }

  /**
   * Получить заявки кооператива
   */
  @Query(() => [RequestDTO], {
    name: 'marketplaceGetCoopRequests',
    description: 'Получить заявки кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['member', 'chairman'])
  async getCoopRequests(
    @Args('data', { type: () => GetCoopRequestsInput }) data: GetCoopRequestsInput
  ): Promise<RequestDTO[]> {
    const filters = {
      coopname: data.coopname,
      ...(data.type && { type: this.convertRequestType(data.type) }),
      ...(data.status && { status: data.status as RequestStatus }),
      limit: data.limit,
    };

    const requests = await this.requestService.findWithFilters(filters);
    return requests.map((req) => RequestDTO.fromDomain(req));
  }

  /**
   * Поиск заявок по названию товара
   */
  @Query(() => [RequestDTO], {
    name: 'marketplaceSearchRequests',
    description: 'Поиск заявок по названию товара',
  })
  async searchRequests(
    @Args('data', { type: () => SearchRequestsInput })
    data: SearchRequestsInput
  ): Promise<RequestDTO[]> {
    const requests = await this.requestService.searchByProductName(data.searchTerm, data.limit);
    return requests.map((req) => RequestDTO.fromDomain(req));
  }

  /**
   * Найти потенциальные совпадения для заявки
   */
  @Query(() => [RequestDTO], {
    name: 'marketplaceFindPotentialMatches',
    description: 'Найти потенциальные совпадения для заявки',
  })
  async findPotentialMatches(
    @Args('data', { type: () => FindPotentialMatchesInput })
    data: FindPotentialMatchesInput
  ): Promise<RequestDTO[]> {
    const matches = await this.requestService.findPotentialMatches(data.requestId);
    return matches.map((req) => RequestDTO.fromDomain(req));
  }

  // /**
  //  * Опубликовать заявку
  //  */
  // @Mutation(() => RequestDTO, {
  //   name: 'marketplacePublishRequest',
  //   description: 'Опубликовать заявку для поиска совпадений',
  // })
  // @UseGuards(GqlJwtAuthGuard, RolesGuard)
  // @AuthRoles(['member', 'chairman'])
  // async publishRequest(
  //   @Args('data', { type: () => PublishRequestInput })
  //   data: PublishRequestInput,
  //   @CurrentUser() user: IMonoAccount
  // ): Promise<RequestDTO> {
  //   // Проверяем, что заявка принадлежит пользователю
  //   const request = await this.requestService.findById(data.id);
  //   if (!request) {
  //     throw new Error('Заявка не найдена');
  //   }

  //   if (request.username !== user.username) {
  //     throw new Error('Нет прав для публикации этой заявки');
  //   }

  //   const publishedRequest = await this.requestService.publishRequest(data.id);
  //   return RequestDTO.fromDomain(publishedRequest);
  // }

  /**
   * Получить статистику заявок
   */
  @Query(() => RequestStatisticsDTO, {
    name: 'marketplaceGetRequestStatistics',
    description: 'Получить статистику заявок кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getRequestStatistics(
    @Args('data', { type: () => GetRequestStatisticsInput }) data: GetRequestStatisticsInput
  ): Promise<RequestStatisticsDTO> {
    const stats = await this.requestService.getRequestStatistics(data.coopname);

    return new RequestStatisticsDTO({
      totalRequests: stats.totalRequests,
      activeOffers: stats.activeOffers,
      activeOrders: stats.activeOrders,
      completedDeals: stats.completedDeals,
      requestsByCategory: stats.requestsByCategory,
    });
  }

  /**
   * Преобразовать тип заявки из GraphQL в доменный
   */
  private convertRequestType(type: RequestTypeInput): RequestType {
    switch (type) {
      case RequestTypeInput.OFFER:
        return RequestType.OFFER;
      case RequestTypeInput.ORDER:
        return RequestType.ORDER;
      default:
        throw new Error(`Неизвестный тип заявки: ${type}`);
    }
  }

  /**
   * Преобразовать тип изображения из GraphQL в доменный
   */
  private convertImageType(type: RequestImageTypeInput): RequestImageType {
    switch (type) {
      case RequestImageTypeInput.REGULAR:
        return RequestImageType.REGULAR;
      case RequestImageTypeInput.PRIMARY:
        return RequestImageType.PRIMARY;
      case RequestImageTypeInput.COLOR_SAMPLE:
        return RequestImageType.COLOR_SAMPLE;
      case RequestImageTypeInput.IMAGE_360:
        return RequestImageType.IMAGE_360;
      default:
        throw new Error(`Неизвестный тип изображения: ${type}`);
    }
  }
}
