import { Inject, Injectable } from '@nestjs/common';
import type { IChairmanApprovalsPort, InnerChairmanApproval, InnerChairmanApprovalsQuery } from '@coopenomics/innercoop';
import { APPROVAL_REPOSITORY, type ApprovalRepository } from '../../domain/repositories/approval.repository';

/**
 * Одобрения председателя для других столов: стол, чей процесс завёл одобрение,
 * показывает его у себя. Документ сюда не входит — подписывая, стол берёт
 * одобрение целиком у председателя по хэшу.
 */
@Injectable()
export class ChairmanInnercoopApprovalsAdapter implements IChairmanApprovalsPort {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly approvals: ApprovalRepository) {}

  async list(query: InnerChairmanApprovalsQuery): Promise<InnerChairmanApproval[]> {
    const found = await this.approvals.findByActions(query);
    return found.map((a) => ({
      approval_hash: a.approval_hash,
      coopname: a.coopname,
      username: a.username,
      action: a.callback_action_approve,
      status: a.status,
      created_at: new Date(a.created_at).toISOString(),
    }));
  }
}
