import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

/**
 * Совет отклонил утверждение редакции документа или не рассмотрел его в срок.
 * Документ вернулся в прежнее состояние, председатель может вынести его снова.
 */
export const documentApprovalDeclinedPayloadSchema = z.object({
  userName: z.string(),
  documentTitles: z.string(),
  decision_id: z.string(),
  reasonText: z.string(),
  coopname: z.string(),
  short_abbr: z.string(),
  name: z.string(),
  templatesUrl: z.string(),
});

export type IPayload = z.infer<typeof documentApprovalDeclinedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Утверждение редакции документа не принято советом';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Уведомление председателю: совет отклонил утверждение редакции документа или решение снято как просроченное')
  .payloadSchema(documentApprovalDeclinedPayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'document-approval-declined-email',
      'Утверждение редакции документа не принято советом {{payload.short_abbr}} {{payload.name}}',
      'Уважаемый {{payload.userName}}!<br><br>Решение № {{payload.decision_id}} об утверждении редакции документов <strong>{{payload.documentTitles}}</strong> {{payload.reasonText}}.<br><br>Кооператив продолжает работать по прежней редакции. Вынести документ на совет повторно можно во вкладке «Шаблоны документов»: <a href="{{payload.templatesUrl}}">{{payload.templatesUrl}}</a>'
    ),
    createInAppStep(
      'document-approval-declined-notification',
      'Утверждение редакции не принято',
      'Решение № {{payload.decision_id}} по документам {{payload.documentTitles}} {{payload.reasonText}}'
    ),
    createPushStep(
      'document-approval-declined-push',
      'Утверждение редакции не принято',
      'Решение № {{payload.decision_id}} {{payload.reasonText}}'
    ),
  ])
  .build();
