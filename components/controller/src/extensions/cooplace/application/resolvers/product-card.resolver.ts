import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { CreateProductCardInputDTO, ProductCardDTO } from '../dto/product-card.dto';
import { ProductCardType, ProductCardStatus } from '../../domain/entities/product-card.entity';
import { ProductCardService } from '../../domain/services/product-card.service';
import { config } from '~/config';

@Resolver(() => ProductCardDTO)
export class ProductCardResolver {
  constructor(private readonly cardService: ProductCardService) {}

  @Query(() => [ProductCardDTO], {
    name: 'getProductCards',
    description: 'Получить опубликованные карточки товаров/услуг',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProductCards(
    @Args('type', { type: () => ProductCardType, nullable: true }) type?: ProductCardType,
    @Args('category_id', { type: () => String, nullable: true }) categoryId?: string,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page?: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit?: number,
  ): Promise<ProductCardDTO[]> {
    const { items } = await this.cardService['cardRepo'].findAll(
      { coopname: config.coopname, type, status: ProductCardStatus.PUBLISHED, category_id: categoryId, search },
      page,
      limit,
    );
    return items as unknown as ProductCardDTO[];
  }

  @Query(() => ProductCardDTO, {
    name: 'getProductCard',
    description: 'Получить карточку по ID',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProductCard(
    @Args('id', { type: () => String }) id: string,
  ): Promise<ProductCardDTO | null> {
    return (await this.cardService['cardRepo'].findById(id)) as unknown as ProductCardDTO | null;
  }

  @Query(() => [ProductCardDTO], {
    name: 'getMyProductCards',
    description: 'Мои карточки (все статусы)',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMyProductCards(
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<ProductCardDTO[]> {
    const { items } = await this.cardService['cardRepo'].findAll(
      { coopname: config.coopname, username: user.username },
    );
    return items as unknown as ProductCardDTO[];
  }

  @Mutation(() => ProductCardDTO, {
    name: 'createProductCard',
    description: 'Создать карточку товара/услуги (черновик)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async createProductCard(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data') data: CreateProductCardInputDTO,
  ): Promise<ProductCardDTO> {
    return (await this.cardService.createCard(config.coopname, user.username, data as any)) as unknown as ProductCardDTO;
  }

  @Mutation(() => ProductCardDTO, {
    name: 'submitProductCardForModeration',
    description: 'Отправить карточку на модерацию',
  })
  @UseGuards(GqlJwtAuthGuard)
  async submitProductCardForModeration(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('id', { type: () => String }) id: string,
  ): Promise<ProductCardDTO> {
    return (await this.cardService.submitForModeration(id, user.username)) as unknown as ProductCardDTO;
  }

  @Mutation(() => ProductCardDTO, {
    name: 'approveProductCard',
    description: 'Одобрить карточку (модерация → публикация)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async approveProductCard(
    @Args('id', { type: () => String }) id: string,
  ): Promise<ProductCardDTO> {
    return (await this.cardService.approve(id)) as unknown as ProductCardDTO;
  }

  @Mutation(() => ProductCardDTO, {
    name: 'rejectProductCard',
    description: 'Отклонить карточку (вернуть в черновик)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async rejectProductCard(
    @Args('id', { type: () => String }) id: string,
  ): Promise<ProductCardDTO> {
    return (await this.cardService.reject(id)) as unknown as ProductCardDTO;
  }

  @Mutation(() => Boolean, {
    name: 'archiveProductCard',
    description: 'Архивировать карточку',
  })
  @UseGuards(GqlJwtAuthGuard)
  async archiveProductCard(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    await this.cardService.archive(id, user.username);
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'deleteProductCard',
    description: 'Удалить черновик карточки',
  })
  @UseGuards(GqlJwtAuthGuard)
  async deleteProductCard(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    const card = await this.cardService['cardRepo'].findById(id);
    if (!card) throw new Error('Карточка не найдена');
    if (card.username !== user.username) throw new Error('Нет доступа');
    if (card.status !== 'draft') throw new Error('Удалить можно только черновик');
    await this.cardService['cardRepo'].delete(id);
    return true;
  }
}
