import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { AuthRoles, GqlJwtAuthGuard, RolesGuard } from '@coopenomics/extension-kit';
import { DocumentApprovalStateService } from '~/domain/document-approval/services/document-approval-state.service';
import { DocumentTemplateDTO } from '../dto/document-template.dto';

/**
 * Реестр шаблонов документов кооператива для стола совета: состав документов
 * ядра и установленных приложений, утверждённые и доступные редакции,
 * состояние каждого документа.
 */
@Resolver()
export class DocumentApprovalResolver {
  constructor(private readonly stateService: DocumentApprovalStateService) {}

  @Query(() => [DocumentTemplateDTO], {
    name: 'documentTemplates',
    description: 'Реестр шаблонов документов кооператива с утверждёнными и доступными редакциями',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async documentTemplates(@Args('coopname', { type: () => String }) coopname: string): Promise<DocumentTemplateDTO[]> {
    return this.stateService.getTemplates(coopname);
  }
}
