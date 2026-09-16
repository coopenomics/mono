import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthRoles, CurrentUser, GqlJwtAuthGuard, RolesGuard } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { DocumentApprovalStateService } from '~/domain/document-approval/services/document-approval-state.service';
import { DocumentApprovalProposalService } from '~/domain/document-approval/services/document-approval-proposal.service';
import { DocumentTemplateDTO } from '../dto/document-template.dto';
import { ProposeDocumentApprovalInputDTO } from '../dto/propose-document-approval.input';

/**
 * Реестр шаблонов документов кооператива для стола совета: состав документов
 * ядра и установленных приложений, утверждённые и доступные редакции,
 * состояние каждого документа.
 */
@Resolver()
export class DocumentApprovalResolver {
  constructor(
    private readonly stateService: DocumentApprovalStateService,
    private readonly proposalService: DocumentApprovalProposalService
  ) {}

  @Query(() => [DocumentTemplateDTO], {
    name: 'documentTemplates',
    description: 'Реестр шаблонов документов кооператива с утверждёнными и доступными редакциями',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async documentTemplates(@Args('coopname', { type: () => String }) coopname: string): Promise<DocumentTemplateDTO[]> {
    return this.stateService.getTemplates(coopname);
  }

  @Mutation(() => [DocumentTemplateDTO], {
    name: 'proposeDocumentApproval',
    description:
      'Вынести редакцию документа или пакет документов на утверждение совета: проект решения с текстом редакции публикуется в повестку',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async proposeDocumentApproval(
    @Args('data', { type: () => ProposeDocumentApprovalInputDTO }) data: ProposeDocumentApprovalInputDTO,
    @CurrentUser() currentUser: IMonoAccount
  ): Promise<DocumentTemplateDTO[]> {
    return this.proposalService.propose({
      coopname: data.coopname,
      registry_ids: data.registry_ids,
      title: data.title,
      username: currentUser.username,
    });
  }
}
