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

export const name = nt('edubridgeAccessGranted.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'dostup-k-kursu-otkryt';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('edubridgeAccessGranted')
  .description(nt('edubridgeAccessGranted.description'))
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'member'])
  .addSteps([
    createEmailStep(
      'edubridge-access-granted-email',
      nt('edubridgeAccessGranted.email.subject'),
      nt('edubridgeAccessGranted.email.body')
    ),
    createInAppStep(
      'edubridge-access-granted-notification',
      nt('edubridgeAccessGranted.inApp.subject'),
      nt('edubridgeAccessGranted.inApp.body')
    ),
    createPushStep(
      'edubridge-access-granted-push',
      nt('edubridgeAccessGranted.push.subject'),
      nt('edubridgeAccessGranted.push.body')
    ),
  ])
  .build();
