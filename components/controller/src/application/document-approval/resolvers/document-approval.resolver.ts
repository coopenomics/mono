import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthRoles, CurrentUser, GqlJwtAuthGuard, RolesGuard } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { DocumentApprovalStateService } from '~/domain/document-approval/services/document-approval-state.service';
import { DocumentApprovalRequirement, DocumentApprovalState } from '~/domain/document-approval/enums/document-approval.enums';
import { DocumentApprovalProposalService } from '~/domain/document-approval/services/document-approval-proposal.service';
import { DocumentTemplateDTO } from '../dto/document-template.dto';
import { ProposeDocumentApprovalInputDTO } from '../dto/propose-document-approval.input';
import { DocumentTemplateBlankDTO, DocumentTemplateEdition } from '../dto/document-template-blank.dto';

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

  @Query(() => Int, {
    name: 'documentTemplatesAttention',
    description: 'Сколько документов кооператива ждут решения совета: без утверждённой редакции или с устаревшей',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async documentTemplatesAttention(@Args('coopname', { type: () => String }) coopname: string): Promise<number> {
    const templates = await this.stateService.getTemplates(coopname);
    return templates.filter(
      (t) =>
        t.approval === DocumentApprovalRequirement.Required &&
        (t.state === DocumentApprovalState.Outdated || t.state === DocumentApprovalState.NotApproved)
    ).length;
  }

  @Query(() => DocumentTemplateBlankDTO, {
    name: 'documentTemplateBlank',
    description: 'Бланк документа без данных субъекта: утверждённая советом редакция или текущая редакция сети',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async documentTemplateBlank(
    @Args('coopname', { type: () => String }) coopname: string,
    @Args('registry_id', { type: () => Int }) registry_id: number,
    @Args('edition', { type: () => DocumentTemplateEdition }) edition: DocumentTemplateEdition
  ): Promise<DocumentTemplateBlankDTO> {
    return this.proposalService.renderBlankHtml(coopname, registry_id, edition);
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
