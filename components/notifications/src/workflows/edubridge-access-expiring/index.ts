import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const payloadSchema = z.object({
  learnerName: z.string(),
  courseTitle: z.string(),
  paidUntil: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof payloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('edubridgeAccessExpiring.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'srok-dostupa-k-kursu-zakanchivaetsya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('edubridgeAccessExpiring')
  .description(nt('edubridgeAccessExpiring.description'))
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'member'])
  .addSteps([
    createEmailStep(
      'edubridge-access-expiring-email',
      nt('edubridgeAccessExpiring.email.subject'),
      nt('edubridgeAccessExpiring.email.body')
    ),
    createInAppStep(
      'edubridge-access-expiring-notification',
      nt('edubridgeAccessExpiring.inApp.subject'),
      nt('edubridgeAccessExpiring.inApp.body')
    ),
    createPushStep(
      'edubridge-access-expiring-push',
      nt('edubridgeAccessExpiring.push.subject'),
      nt('edubridgeAccessExpiring.push.body')
    ),
  ])
  .build();
