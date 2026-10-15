
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для approval-request воркфлоу
export const approvalRequestPayloadSchema = z.object({
  chairmanName: z.string(),
  requestTitle: z.string(),
  requestDescription: z.string(),
  authorName: z.string(),
  coopname: z.string(),
  approval_hash: z.string(),
  approvalUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof approvalRequestPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('approvalRequest.name')
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'zapros-na-odobrenie-predsedatelya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('approvalRequest')
  .description(nt('approvalRequest.description'))
  .payloadSchema(approvalRequestPayloadSchema)
  .tags(['chairman']) // Только для председателя
  .addSteps([
    createEmailStep(
      'approval-request-email',
      nt('approvalRequest.email.subject'),
      nt('approvalRequest.email.body')
    ),
    createInAppStep(
      'approval-request-notification',
      nt('approvalRequest.inApp.subject'),
      nt('approvalRequest.inApp.body')
    ),
    createPushStep(
      'approval-request-push',
      nt('approvalRequest.push.subject'),
      nt('approvalRequest.push.body')
    ),
  ])
  .build();

