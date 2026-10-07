import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const payloadSchema = z.object({
  courseTitle: z.string(),
  lessonTitle: z.string(),
  decisionId: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof payloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('edubridgeRidCouncilApproved.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'sovet-prinyal-zayavlenie-o-vznose-rid';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('edubridgeRidCouncilApproved')
  .description(nt('edubridgeRidCouncilApproved.description'))
  .payloadSchema(payloadSchema)
  .tags(['edubridge', 'teacher'])
  .addSteps([
    createEmailStep(
      'edubridge-rid-council-approved-email',
      nt('edubridgeRidCouncilApproved.email.subject'),
      nt('edubridgeRidCouncilApproved.email.body')
    ),
    createInAppStep(
      'edubridge-rid-council-approved-notification',
      nt('edubridgeRidCouncilApproved.inApp.subject'),
      nt('edubridgeRidCouncilApproved.inApp.body')
    ),
    createPushStep(
      'edubridge-rid-council-approved-push',
      nt('edubridgeRidCouncilApproved.push.subject'),
      nt('edubridgeRidCouncilApproved.push.body')
    ),
  ])
  .build();
