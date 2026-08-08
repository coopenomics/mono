import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CreateCategoryInputDTO, CategoryDTO } from '../dto/category.dto';

@Resolver(() => CategoryDTO)
export class CategoryResolver {
  @Query(() => [CategoryDTO], {
    name: 'getCategories',
    description: 'Получить дерево категорий',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getCategories(): Promise<CategoryDTO[]> {
    return [];
  }

  @Mutation(() => CategoryDTO, {
    name: 'createCategory',
    description: 'Создать категорию (админ)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async createCategory(
    @Args('data') data: CreateCategoryInputDTO,
  ): Promise<CategoryDTO> {
    return {} as CategoryDTO;
  }

  @Mutation(() => Boolean, {
    name: 'deleteCategory',
    description: 'Удалить категорию (админ)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteCategory(
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return true;
  }
}
