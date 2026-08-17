// ========== ./resolvers/extension.resolver.ts ==========
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AppManagementService } from '../services/extension.service';
import { ExtensionDTO } from '../dto/extension-graphql.dto';
import { ExtensionGraphQLInput } from '../dto/extension-graphql-input.dto';
import { ExtensionLogDTO } from '../dto/extension-log.dto';
import { GetExtensionLogsInputDTO } from '../dto/get-extension-logs-input.dto';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, createPaginationResult, PaginationInputDTO } from '@coopenomics/extension-kit';
import { GetExtensionsGraphQLInput } from '../dto/get-extensions-input.dto';
import { UninstallExtensionGraphQLInput } from '../dto/uninstall-extension-input.dto';
const ExtensionLogsPaginationResult = createPaginationResult(ExtensionLogDTO, 'ExtensionLogs');

@Resolver(() => ExtensionDTO)
export class AppStoreResolver<TConfig = any> {
  constructor(private readonly appManagementService: AppManagementService<TConfig>) {}

  @Query(() => [ExtensionDTO], { name: 'getExtensions', description: 'Получить список расширений' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async getAppList(
    @Args('data', { type: () => GetExtensionsGraphQLInput, nullable: true }) data?: GetExtensionsGraphQLInput
  ): Promise<ExtensionDTO<TConfig>[]> {
    return this.appManagementService.getCombinedAppList(data);
  }

  @Query(() => ExtensionLogsPaginationResult, {
    name: 'getExtensionLogs',
    description: 'Получить логи расширений с фильтрацией и пагинацией',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getExtensionLogs(
    @Args('data', { type: () => GetExtensionLogsInputDTO, nullable: true }) data?: GetExtensionLogsInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<{ items: ExtensionLogDTO[]; totalCount: number; totalPages: number; currentPage: number }> {
    return this.appManagementService.getExtensionLogs(data, options);
  }

  @Mutation(() => ExtensionDTO, { name: 'installExtension', description: 'Установить расширение' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async installApp(
    @Args('data', { type: () => ExtensionGraphQLInput }) data: ExtensionGraphQLInput<TConfig>
  ): Promise<ExtensionDTO<TConfig>> {
    return this.appManagementService.installApp(data);
  }

  @Mutation(() => ExtensionDTO, { name: 'updateExtension', description: 'Обновить расширение' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async updateExtension(
    @Args('data', { type: () => ExtensionGraphQLInput }) data: ExtensionGraphQLInput<TConfig>
  ): Promise<ExtensionDTO<TConfig>> {
    return this.appManagementService.updateApp(data);
  }

  @Mutation(() => Boolean, { name: 'uninstallExtension', description: 'Удалить расширение' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async uninstallApp(
    @Args('data', { type: () => UninstallExtensionGraphQLInput }) data: UninstallExtensionGraphQLInput
  ): Promise<boolean> {
    return this.appManagementService.uninstallApp(data);
  }
}
