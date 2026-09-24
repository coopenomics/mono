import { Inject, Injectable, Optional } from '@nestjs/common';
import { CHAIRMAN_APPROVALS_PORT, type IChairmanApprovalsPort } from '@coopenomics/innercoop';
import { EduApprovalDTO } from '../dto/edu-approval.dto';
import { t } from '../../i18n';

/**
 * Одобрения образовательной программы — договор УХД преподавателя и приложения
 * к нему на курс. Хранит их председатель; стол администратора показывает их в
 * карточке преподавателя, чтобы подписать, не переходя на стол председателя.
 * Одобрение одно: подпись здесь закрывает его и в «Запросах одобрений».
 */
export const EDU_APPROVAL_TITLES: Record<string, string> = {
  apprvcontr: t('edubridge.approvals.title.apprvcontr'),
  apprvannex: t('edubridge.approvals.title.apprvannex'),
};

@Injectable()
export class EdubridgeApprovalsService {
  constructor(@Optional() @Inject(CHAIRMAN_APPROVALS_PORT) private readonly approvals: IChairmanApprovalsPort | null) {}

  /** Сколько документов преподавателей кооператива ждут подписи председателя. */
  async pendingCount(coopname: string): Promise<number> {
    if (!this.approvals) return 0;
    const found = await this.approvals.list({ coopname, actions: Object.keys(EDU_APPROVAL_TITLES), statuses: ['pending'] });
    return found.length;
  }

  /** Документы преподавателя, которые ждут подписи председателя. */
  async pendingForTeacher(coopname: string, username: string): Promise<EduApprovalDTO[]> {
    if (!this.approvals) return [];
    const found = await this.approvals.list({
      coopname,
      actions: Object.keys(EDU_APPROVAL_TITLES),
      usernames: [username],
      statuses: ['pending'],
    });
    return found.map((a) => ({
      approval_hash: a.approval_hash,
      username: a.username,
      action: a.action,
      title: EDU_APPROVAL_TITLES[a.action] ?? a.action,
      created_at: new Date(a.created_at),
    }));
  }
}
