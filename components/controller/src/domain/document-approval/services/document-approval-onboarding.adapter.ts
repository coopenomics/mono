import { Inject, Injectable } from '@nestjs/common';
import type {
  IDocumentApprovalPort,
  InnerOnboardingStepProposal,
  InnerProposeOnboardingStepInput,
} from '@coopenomics/innercoop';
import config from '~/config/config';
import { documentsOwnerOf } from '../constants/core-document-declarations';
import { DOCUMENT_DECLARATION_QUERY_PORT, type DocumentDeclarationQueryPort } from '../ports/document-declaration-query.port';
import { DocumentApprovalRequirement, DocumentApprovalState } from '../enums/document-approval.enums';
import { DocumentApprovalProposalService } from './document-approval-proposal.service';
import { DocumentApprovalStateService } from './document-approval-state.service';

/**
 * Шаги подключения расширений поверх фабрики утверждений: шаг = пакет
 * документов с тем же ключом. Так первое утверждение и каждое следующее идут
 * одним механизмом, а карточка подключения и вкладка «Шаблоны документов»
 * показывают одно состояние.
 */
@Injectable()
export class DocumentApprovalOnboardingAdapter implements IDocumentApprovalPort {
  constructor(
    @Inject(DOCUMENT_DECLARATION_QUERY_PORT)
    private readonly declarations: DocumentDeclarationQueryPort,
    private readonly state: DocumentApprovalStateService,
    private readonly proposal: DocumentApprovalProposalService
  ) {}

  async proposeOnboardingStep(input: InnerProposeOnboardingStepInput): Promise<InnerOnboardingStepProposal | null> {
    const owner = documentsOwnerOf(input.extension_name);
    const declared = this.declarations
      .getByBundle(owner, input.step_key)
      .filter((d) => d.approval === 'required');
    if (declared.length === 0) return null;

    const templates = await this.state.getTemplates(config.coopname);
    const ids = new Set(declared.map((d) => d.registry_id));
    const stepTemplates = templates.filter((t) => ids.has(t.registry_id));

    const pending = stepTemplates.find((t) => t.state === DocumentApprovalState.Pending);
    if (pending) {
      return { hash: pending.pending_hash, registry_ids: stepTemplates.map((t) => t.registry_id), approved: false };
    }

    const waiting = stepTemplates.filter(
      (t) => t.state === DocumentApprovalState.NotApproved || t.state === DocumentApprovalState.Outdated
    );
    if (waiting.length === 0) {
      return { hash: null, registry_ids: stepTemplates.map((t) => t.registry_id), approved: true };
    }

    const result = await this.proposal.propose({
      coopname: config.coopname,
      registry_ids: waiting.map((t) => t.registry_id),
      username: input.username,
      title: input.title,
      onboarding: { extension: input.extension_name, step: input.step_key },
    });
    const hash = result.find((t) => t.pending_hash)?.pending_hash ?? null;
    return { hash, registry_ids: waiting.map((t) => t.registry_id), approved: false };
  }

  async isStepApproved(extension_name: string, step_key: string): Promise<boolean> {
    const owner = documentsOwnerOf(extension_name);
    const declared = this.declarations
      .getByBundle(owner, step_key)
      .filter((d) => d.approval === 'required');
    if (declared.length === 0) return false;

    const templates = await this.state.getTemplates(config.coopname);
    const ids = new Set(declared.map((d) => d.registry_id));
    const stepTemplates = templates.filter((t) => ids.has(t.registry_id) && t.approval === DocumentApprovalRequirement.Required);
    return (
      stepTemplates.length === declared.length &&
      stepTemplates.every((t) => t.state === DocumentApprovalState.Approved || t.state === DocumentApprovalState.Outdated)
    );
  }
}
