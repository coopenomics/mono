import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Схема для branch-trusted-resolved воркфлоу
export const branchTrustedResolvedPayloadSchema = z.object({
  coopShortName: z.string(),
  // «одобрена» или «отклонена» — готовая словоформа для текста уведомления
  resolution: z.string(),
  branchUrl: z.string(),
});

export type IPayload = z.infer<typeof branchTrustedResolvedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Заявка доверенного лица рассмотрена';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление заявителю о решении председателя кооперативного участка по заявке доверенного лица')
  .payloadSchema(branchTrustedResolvedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-trusted-resolved-email',
      'Ваша заявка доверенного лица {{payload.resolution}} в {{payload.coopShortName}}',
      'Уважаемый пайщик!<br><br>Ваша заявка на приём доверенным лицом кооперативного участка {{payload.resolution}} председателем участка.<br><br>Подробности на странице участка:<br><a href="{{payload.branchUrl}}">{{payload.branchUrl}}</a><br><br>С уважением, {{payload.coopShortName}}.'
    ),
    createInAppStep(
      'branch-trusted-resolved-notification',
      'Заявка доверенного лица {{payload.resolution}}',
      'Председатель участка рассмотрел вашу заявку: она {{payload.resolution}}'
    ),
    createPushStep(
      'branch-trusted-resolved-push',
      'Заявка доверенного {{payload.resolution}}',
      'Председатель участка рассмотрел вашу заявку'
    ),
  ])
  .build();
