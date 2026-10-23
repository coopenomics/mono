import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для branch-trusted-requested воркфлоу
export const branchTrustedRequestedPayloadSchema = z.object({
  coopShortName: z.string(),
  applicantName: z.string(),
  branchUrl: z.string(),
});

export type IPayload = z.infer<typeof branchTrustedRequestedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('branchTrustedRequested.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'novaya-zayavka-doverennogo-litsa-uchastka';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('branchTrustedRequested')
  .description(nt('branchTrustedRequested.description'))
  .payloadSchema(branchTrustedRequestedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-trusted-requested-email',
      nt('branchTrustedRequested.email.subject'),
      nt('branchTrustedRequested.email.body')
    ),
    createInAppStep(
      'branch-trusted-requested-notification',
      nt('branchTrustedRequested.inApp.subject'),
      nt('branchTrustedRequested.inApp.body')
    ),
    createPushStep(
      'branch-trusted-requested-push',
      nt('branchTrustedRequested.push.subject'),
      nt('branchTrustedRequested.push.body')
    ),
  ])
  .build();
