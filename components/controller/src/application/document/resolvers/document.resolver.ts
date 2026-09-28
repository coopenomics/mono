import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { GetDocumentsInputDTO } from '../dto/get-documents-input.dto';
import { createPaginationResult, AuthRoles, GqlJwtAuthGuard, RolesGuard, CurrentUser, GeneratedDocumentDTO, DomainError } from '@coopenomics/extension-kit';
import { DocumentPackageAggregateDTO } from '~/application/agenda/dto/document-package-aggregate.dto';
import { DocumentService } from '../services/document.service';
import type { PaginationResultDomainInterface } from '~/domain/common/interfaces/pagination.interface';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import { UseGuards } from '@nestjs/common';
import { GenerateAnyDocumentInputDTO } from '../dto/generate-any-document-input.dto';
import { GetPublicProvisionInputDTO, PublicProvisionDTO } from '../dto/public-provision.dto';
import { PublicProvisionService } from '../services/public-provision.service';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';

/**
 * Протоколы решений совета: их собирает председатель (или член совета) на имя
 * заявителя, чьё заявление рассматривает совет. Список — из единого реестра
 * решений (decisionTypesRegistry), отдельно его нигде не ведём.
 */
const DECISION_PROTOCOL_REGISTRY_IDS = new Set<number>(
  Object.values(Cooperative.Document.decisionTypesRegistry).map((info) => Number(info.protocol_registry_id))
);
const COUNCIL_ROLES = ['chairman', 'member'];

const paginationResultAggregate = createPaginationResult(DocumentPackageAggregateDTO, 'DocumentsAggregate');

@Resolver()
export class DocumentResolver {
  constructor(
    private readonly documentService: DocumentService,
    private readonly publicProvisionService: PublicProvisionService
  ) {}

  @Query(() => PublicProvisionDTO, {
    name: 'getPublicProvision',
    description:
      'Получить текст публичного положения кооператива (политика обработки персональных данных и другие положения, не зависящие от субъекта)',
  })
  async getPublicProvision(
    @Args('data', { type: () => GetPublicProvisionInputDTO }) data: GetPublicProvisionInputDTO
  ): Promise<PublicProvisionDTO> {
    return this.publicProvisionService.getProvisionHtml(data.registry_id);
  }

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
      throw DomainError.unauthorized('DOCUMENT_USER_NOT_AUTHORIZED');
    }

    // Документ собирается на себя. Исключение — протокол решения совета: его
    // председатель и члены совета собирают на имя заявителя. Без исключения
    // (ужесточение 17.09.2026) рабочий стол не мог утвердить вручную ни одно
    // решение по чужому заявлению — например, материальную помощь (до 25.09.2026).
    const forSelf = !!input.data.username && input.data.username === currentUser.username;
    const councilProtocol =
      !!input.data.username &&
      COUNCIL_ROLES.includes(currentUser.role) &&
      DECISION_PROTOCOL_REGISTRY_IDS.has(Number(input.data.registry_id));
    if (!forSelf && !councilProtocol) {
      throw DomainError.unauthorized('DOCUMENT_GENERATION_FORBIDDEN');
    }

    return this.documentService.generateAnyDocument(input);
  }
}
