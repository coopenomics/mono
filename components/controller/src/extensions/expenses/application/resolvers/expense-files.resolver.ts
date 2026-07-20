import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ExpenseFilesService } from '../services/expense-files.service';
import { UploadExpenseFileInputDTO } from '../dto/upload-expense-file.input';
import { ExpenseFileOutputDTO } from '../dto/expense-file.output';

/**
 * GraphQL для файлов расхода: загрузка (mutation) + чтение списков (queries).
 *
 * - Загружают пайщик и председатель (всем трём ролям нужно для разных сценариев:
 *   пайщик — чек/возврат, председатель — платёжка).
 * - Списки видят те же роли, при необходимости ACL уточнится после E2E.
 */
@Resolver(() => ExpenseFileOutputDTO)
export class ExpenseFilesResolver {
  constructor(private readonly expenseFiles: ExpenseFilesService) {}

  @Mutation(() => ExpenseFileOutputDTO, {
    name: 'uploadExpenseFile',
    description: 'Загрузить первичный файл расхода (платёжка/чек/возврат) в бакет expenses:files.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async uploadExpenseFile(
    @Args('data', { type: () => UploadExpenseFileInputDTO }) data: UploadExpenseFileInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<ExpenseFileOutputDTO> {
    const { data: saved, readUrl } = await this.expenseFiles.uploadFile(data, user.username);
    return ExpenseFileOutputDTO.fromDomain(saved, readUrl);
  }

  @Query(() => ExpenseFileOutputDTO, {
    name: 'expenseFile',
    description: 'Получить запись о файле + свежий короткоживущий read-URL.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async getExpenseFile(@Args('id', { type: () => Int }) id: number): Promise<ExpenseFileOutputDTO> {
    const { data, readUrl } = await this.expenseFiles.getReadUrl(id);
    return ExpenseFileOutputDTO.fromDomain(data, readUrl);
  }

  @Query(() => [ExpenseFileOutputDTO], {
    name: 'expenseFilesByProposal',
    description: 'Список файлов сметы расхода (без read-URL — запрос отдельно по id).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async listByProposal(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('proposal_hash', { type: () => String }) proposalHash: string
  ): Promise<ExpenseFileOutputDTO[]> {
    const items = await this.expenseFiles.listByProposal(coopname, proposalHash);
    return items.map((d) => ExpenseFileOutputDTO.fromDomain(d));
  }

  @Query(() => [ExpenseFileOutputDTO], {
    name: 'expenseFilesByItem',
    description: 'Список файлов строки расхода (без read-URL — запрос отдельно по id).',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async listByItem(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('proposal_hash', { type: () => String }) proposalHash: string,
    @Args('item_hash', { type: () => String }) itemHash: string
  ): Promise<ExpenseFileOutputDTO[]> {
    const items = await this.expenseFiles.listByItem(coopname, proposalHash, itemHash);
    return items.map((d) => ExpenseFileOutputDTO.fromDomain(d));
  }
}
