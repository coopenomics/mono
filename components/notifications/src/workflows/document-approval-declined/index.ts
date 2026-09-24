import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

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

export const name = nt('documentApprovalDeclined.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'utverzhdenie-redaktsii-dokumenta-ne-prinyato-sovetom';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('documentApprovalDeclined')
  .description(nt('documentApprovalDeclined.description'))
  .payloadSchema(documentApprovalDeclinedPayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'document-approval-declined-email',
      nt('documentApprovalDeclined.email.subject'),
      nt('documentApprovalDeclined.email.body')
    ),
    createInAppStep(
      'document-approval-declined-notification',
      nt('documentApprovalDeclined.inApp.subject'),
      nt('documentApprovalDeclined.inApp.body')
    ),
    createPushStep(
      'document-approval-declined-push',
      nt('documentApprovalDeclined.push.subject'),
      nt('documentApprovalDeclined.push.body')
    ),
  ])
  .build();
