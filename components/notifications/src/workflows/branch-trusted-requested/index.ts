import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема для branch-trusted-requested воркфлоу
export const branchTrustedRequestedPayloadSchema = z.object({
  coopShortName: z.string(),
  applicantName: z.string(),
  branchUrl: z.string(),
});

export type IPayload = z.infer<typeof branchTrustedRequestedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Новая заявка доверенного лица участка';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление председателю кооперативного участка о новой заявке пайщика на приём доверенным лицом')
  .payloadSchema(branchTrustedRequestedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-trusted-requested-email',
      'Новая заявка доверенного лица участка в {{payload.coopShortName}}',
      'Уважаемый председатель кооперативного участка!<br><br>Пайщик {{payload.applicantName}} подал заявку на приём доверенным лицом вашего кооперативного участка.<br><br>Рассмотреть заявку можно на странице участка:<br><a href="{{payload.branchUrl}}">{{payload.branchUrl}}</a><br><br>С уважением, {{payload.coopShortName}}.'
    ),
    createInAppStep(
      'branch-trusted-requested-notification',
      'Новая заявка доверенного лица',
      '{{payload.applicantName}} подал заявку на приём доверенным лицом участка'
    ),
    createPushStep(
      'branch-trusted-requested-push',
      'Новая заявка доверенного лица',
      '{{payload.applicantName}} подал заявку доверенного'
    ),
  ])
  .build();
