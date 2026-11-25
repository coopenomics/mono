import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, RequireRight, RightsGuard } from '@coopenomics/extension-kit';
import { DocumentReproducibilityAuditDTO, DocumentReproducibilityAuditInputDTO } from '../dto/document-reproducibility-audit.dto';
import { DocumentReproducibilityAuditService } from '../services/document-reproducibility-audit.service';

@Resolver()
export class DocumentReproducibilityAuditResolver {
  constructor(private readonly audit: DocumentReproducibilityAuditService) {}

  @Query(() => DocumentReproducibilityAuditDTO, {
    name: 'auditDocumentReproducibility',
    description:
      'Пересобрать сохранённые документы узла по их метаданным и сравнить с хранилищем. Отчёт по видам документов и версиям сборщика, без содержимого документов.',
  })
  @UseGuards(GqlJwtAuthGuard, RightsGuard)
  @RequireRight('System', 'manage')
  async auditDocumentReproducibility(
    @Args('data', { type: () => DocumentReproducibilityAuditInputDTO, nullable: true })
    data?: DocumentReproducibilityAuditInputDTO
  ): Promise<DocumentReproducibilityAuditDTO> {
    return this.audit.audit(data ?? {});
  }
}
