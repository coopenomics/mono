import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Доверенность председателя кооперативного участка подходит к концу срока
// (решение владельца 18.11.2026): за тридцать дней председатель участка получает
// напоминание и подписывает новую на своём участке. С истёкшей доверенностью
// он не работает с пунктом выдачи.
export const branchAuthorityExpiringPayloadSchema = z.object({
  trusteeName: z.string(),
  branchName: z.string(),
  poaNumber: z.string(),
  daysLeft: z.string(),
  validUntil: z.string(),
  branchUrl: z.string(),
});

export type IPayload = z.infer<typeof branchAuthorityExpiringPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('branchAuthorityExpiring.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'doverennost-predsedatelya-uchastka-istekaet';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('branchAuthorityExpiring')
  .description(nt('branchAuthorityExpiring.description'))
  .payloadSchema(branchAuthorityExpiringPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-authority-expiring-email',
      nt('branchAuthorityExpiring.email.subject'),
      nt('branchAuthorityExpiring.email.body')
    ),
    createInAppStep(
      'branch-authority-expiring-notification',
      nt('branchAuthorityExpiring.inApp.subject'),
      nt('branchAuthorityExpiring.inApp.body')
    ),
    createPushStep(
      'branch-authority-expiring-push',
      nt('branchAuthorityExpiring.push.subject'),
      nt('branchAuthorityExpiring.push.body')
    ),
  ])
  .build();
