import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import type { MonoAccountDomainInterface } from '@coopenomics/innercoop';
import { CreateProductCardInputDTO, ProductCardDTO } from '../dto/product-card.dto';
import { ProductCardType, ProductCardStatus } from '../../domain/entities/product-card.entity';

@Resolver(() => ProductCardDTO)
export class ProductCardResolver {
  @Query(() => [ProductCardDTO], {
    name: 'getProductCards',
    description: 'Получить карточки товаров/услуг',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getProductCards(
    @Args('type', { type: () => ProductCardType, nullable: true }) type?: ProductCardType,
    @Args('status', { type: () => ProductCardStatus, nullable: true }) status?: ProductCardStatus,
    @Args('category_id', { type: () => String, nullable: true }) categoryId?: string,
    @Args('search', { type: () => String, nullable: true }) search?: string,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page?: number,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit?: number,
  ): Promise<ProductCardDTO[]> {
    return [];
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
    return null;
  }

  @Query(() => [ProductCardDTO], {
    name: 'getMyProductCards',
    description: 'Мои карточки',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMyProductCards(
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<ProductCardDTO[]> {
    return [];
  }

  @Mutation(() => ProductCardDTO, {
    name: 'createProductCard',
    description: 'Создать карточку товара/услуги',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async createProductCard(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data') data: CreateProductCardInputDTO,
  ): Promise<ProductCardDTO> {
    return {} as ProductCardDTO;
  }

  @Mutation(() => Boolean, {
    name: 'publishProductCard',
    description: 'Опубликовать карточку',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async publishProductCard(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'archiveProductCard',
    description: 'Архивировать карточку',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async archiveProductCard(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'deleteProductCard',
    description: 'Удалить черновик карточки',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async deleteProductCard(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return true;
  }
}
