import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { BranchService } from '../services/branch.service';
import { GetBranchesGraphQLInput } from '../dto/get-branches-input.dto';
import { BranchDTO } from '../dto/branch.dto';
import { GqlJwtAuthGuard, RolesGuard, AuthRoles, CurrentUser } from '@coopenomics/extension-kit';
import { UseGuards } from '@nestjs/common';
import { CreateBranchGraphQLInput } from '../dto/create-branch-input.dto';
import { EditBranchGraphQLInput } from '../dto/edit-branch-input.dto';
import { DeleteBranchGraphQLInput } from '../dto/delete-branch-input.dto';
import { AddTrustedAccountGraphQLInput } from '../dto/add-trusted-account-input.dto';
import { DeleteTrustedAccountGraphQLInput } from '../dto/delete-trusted-account-input.dto';
import { SetBranchPrivateGraphQLInput } from '../dto/set-branch-private-input.dto';
import { AddBranchWhitelistGraphQLInput } from '../dto/add-branch-whitelist-input.dto';
import { DeleteBranchWhitelistGraphQLInput } from '../dto/delete-branch-whitelist-input.dto';
import { SelectBranchInputDTO } from '../dto/select-branch-input.dto';
import type { MonoAccountDomainInterface } from '@coopenomics/innercoop';
import { SelectBranchGenerateDocumentInputDTO } from '../../document/documents-dto/select-branch-document.dto';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';

@Resolver(() => BranchDTO)
export class BranchResolver {
  constructor(private readonly branchService: BranchService) {}

  @Query(() => [BranchDTO], {
    name: 'getBranches',
    description: 'Получить список кооперативных участков',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async getBranches(
    @Args('data', { type: () => GetBranchesGraphQLInput }) data: GetBranchesGraphQLInput,
    @CurrentUser() currentUser: MonoAccountDomainInterface
  ): Promise<BranchDTO[]> {
    // имя текущего пайщика нужно, чтобы вычислить доступность приватных участков (is_available)
    return this.branchService.getBranches(data, currentUser?.username);
  }

  @Mutation(() => BranchDTO, { name: 'createBranch', description: 'Создать кооперативный участок' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async createBranch(
    @Args('data', { type: () => CreateBranchGraphQLInput }) data: CreateBranchGraphQLInput
  ): Promise<BranchDTO> {
    return this.branchService.createBranch(data);
  }

  @Mutation(() => BranchDTO, { name: 'editBranch', description: 'Изменить кооперативный участок' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async editBranch(@Args('data', { type: () => EditBranchGraphQLInput }) data: EditBranchGraphQLInput): Promise<BranchDTO> {
    return this.branchService.editBranch(data);
  }

  @Mutation(() => Boolean, { name: 'deleteBranch', description: 'Удалить кооперативный участок' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteBranch(
    @Args('data', { type: () => DeleteBranchGraphQLInput }) data: DeleteBranchGraphQLInput
  ): Promise<boolean> {
    return this.branchService.deleteBranch(data);
  }

  @Mutation(() => BranchDTO, {
    name: 'addTrustedAccount',
    description: 'Добавить доверенное лицо кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addTrustedAccount(
    @Args('data', { type: () => AddTrustedAccountGraphQLInput }) data: AddTrustedAccountGraphQLInput
  ): Promise<BranchDTO> {
    return this.branchService.addTrustedAccount(data);
  }

  @Mutation(() => BranchDTO, {
    name: 'deleteTrustedAccount',
    description: 'Удалить доверенное лицо кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteTrustedAccount(
    @Args('data', { type: () => DeleteTrustedAccountGraphQLInput }) data: DeleteTrustedAccountGraphQLInput
  ): Promise<BranchDTO> {
    return this.branchService.deleteTrustedAccount(data);
  }

  @Mutation(() => BranchDTO, {
    name: 'setBranchPrivate',
    description: 'Установить приватность кооперативного участка (выбор только из белого списка)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async setBranchPrivate(
    @Args('data', { type: () => SetBranchPrivateGraphQLInput }) data: SetBranchPrivateGraphQLInput
  ): Promise<BranchDTO> {
    return this.branchService.setBranchPrivate(data);
  }

  @Mutation(() => BranchDTO, {
    name: 'addBranchWhitelist',
    description: 'Добавить пайщика в белый список приватного кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addBranchWhitelist(
    @Args('data', { type: () => AddBranchWhitelistGraphQLInput }) data: AddBranchWhitelistGraphQLInput
  ): Promise<BranchDTO> {
    return this.branchService.addBranchWhitelist(data);
  }

  @Mutation(() => BranchDTO, {
    name: 'deleteBranchWhitelist',
    description: 'Удалить пайщика из белого списка приватного кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async deleteBranchWhitelist(
    @Args('data', { type: () => DeleteBranchWhitelistGraphQLInput }) data: DeleteBranchWhitelistGraphQLInput
  ): Promise<BranchDTO> {
    return this.branchService.deleteBranchWhitelist(data);
  }

  @Mutation(() => Boolean, { name: 'selectBranch', description: 'Выбрать кооперативный участок' })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async selectBranch(@Args('data', { type: () => SelectBranchInputDTO }) data: SelectBranchInputDTO): Promise<boolean> {
    return this.branchService.selectBranch(data);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateSelectBranchDocument',
    description: 'Сгенерировать документ, подтверждающий выбор кооперативного участка',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async generateSelectBranchDocument(
    @Args('data', { type: () => SelectBranchGenerateDocumentInputDTO }) data: SelectBranchGenerateDocumentInputDTO,
    @Args('options', { type: () => GenerateDocumentOptionsInputDTO, nullable: true })
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    return this.branchService.generateSelectBranchDocument(data, options);
  }
}
