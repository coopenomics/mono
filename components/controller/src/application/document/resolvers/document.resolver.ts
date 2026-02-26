import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { GetDocumentsInputDTO } from '../dto/get-documents-input.dto';
import { createPaginationResult } from '~/application/common/dto/pagination.dto';
import { DocumentPackageAggregateDTO } from '~/application/agenda/dto/document-package-aggregate.dto';
import { DocumentService } from '../services/document.service';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { GenerateAnyDocumentInputDTO } from '../dto/generate-any-document-input.dto';
import { GeneratedDocumentDTO } from '../dto/generated-document.dto';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';

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

  @Query(() => DocumentPackageAggregateDTO, {
    name: 'getDocumentPackageByHash',
    description: 'Получить пакет документов по хешу (заявление + решение + акты)',
    nullable: true,
  })
  @UseGuards(GqlJwtAuthGuard)
  async getDocumentPackageByHash(
    @Args('hash', { type: () => String }) hash: string
  ): Promise<DocumentPackageAggregateDTO | null> {
    return this.documentService.getDocumentPackageByHash(hash);
  }

  @Mutation(() => GeneratedDocumentDTO, {
    name: 'generateDocument',
    description: 'Универсальная генерация документа с произвольными данными (только для председателя)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  async generateDocument(
    @Args('input', { type: () => GenerateAnyDocumentInputDTO }) input: GenerateAnyDocumentInputDTO,
    @CurrentUser() currentUser: MonoAccountDomainInterface
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
