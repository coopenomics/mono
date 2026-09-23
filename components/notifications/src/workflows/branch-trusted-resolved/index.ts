import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для branch-trusted-resolved воркфлоу
export const branchTrustedResolvedPayloadSchema = z.object({
  coopShortName: z.string(),
  // «одобрена» или «отклонена» — готовая словоформа для текста уведомления
  resolution: z.string(),
  branchUrl: z.string(),
});

export type IPayload = z.infer<typeof branchTrustedResolvedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('branchTrustedResolved.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'zayavka-doverennogo-litsa-rassmotrena';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('branchTrustedResolved')
  .description(nt('branchTrustedResolved.description'))
  .payloadSchema(branchTrustedResolvedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-trusted-resolved-email',
      nt('branchTrustedResolved.email.subject'),
      nt('branchTrustedResolved.email.body')
    ),
    createInAppStep(
      'branch-trusted-resolved-notification',
      nt('branchTrustedResolved.inApp.subject'),
      nt('branchTrustedResolved.inApp.body')
    ),
    createPushStep(
      'branch-trusted-resolved-push',
      nt('branchTrustedResolved.push.subject'),
      nt('branchTrustedResolved.push.body')
    ),
  ])
  .build();
