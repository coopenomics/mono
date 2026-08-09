import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { GetDocumentsInputDTO } from '../dto/get-documents-input.dto';
import { createPaginationResult, AuthRoles, GqlJwtAuthGuard, RolesGuard, CurrentUser, GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import { DocumentPackageAggregateDTO } from '~/application/agenda/dto/document-package-aggregate.dto';
import { DocumentService } from '../services/document.service';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { GenerateAnyDocumentInputDTO } from '../dto/generate-any-document-input.dto';
import type { IMonoAccount } from '@coopenomics/innercoop';

const paginationResultAggregate = createPaginationResult(DocumentPackageAggregateDTO, 'DocumentsAggregate');

@Resolver()
export class DocumentResolver {
  constructor(private readonly documentService: DocumentService) {}

  @Query(() => paginationResultAggregate)
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async getDocuments(
    @Args('data', { type: () => GetDocumentsInputDTO }) data: GetDocumentsInputDTO
  ): Promise<PaginationResultDomainInterface<DocumentPackageAggregateDomainInterface>> {
    return this.documentService.getDocumentsAggregate(data);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDocument',
    description: 'Универсальная генерация документа с произвольными данными (только для председателя)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async generateDocument(
    @Args('input', { type: () => GenerateAnyDocumentInputDTO }) input: GenerateAnyDocumentInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<GeneratedDocumentDTO> {
    // Проверяем, что пользователь авторизован
    if (!currentUser?.username) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }

    // Проверяем, что username в input.data соответствует текущему пользователю
    if (!input.data.username || input.data.username !== currentUser.username) {
      throw new UnauthorizedException('Недостаточно прав доступа для генерации документа');
    }

    return this.documentService.generateAnyDocument(input);
  }
}
