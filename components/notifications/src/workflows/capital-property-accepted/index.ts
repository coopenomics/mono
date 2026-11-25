import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const payloadSchema = z.object({
  propertyName: z.string(),
  amount: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof payloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('capitalPropertyAccepted.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'vznos-imushchestvom-prinyat';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('capitalPropertyAccepted')
  .description(nt('capitalPropertyAccepted.description'))
  .payloadSchema(payloadSchema)
  .tags(['capital', 'contributor'])
  .addSteps([
    createEmailStep(
      'capital-property-accepted-email',
      nt('capitalPropertyAccepted.email.subject'),
      nt('capitalPropertyAccepted.email.body')
    ),
    createInAppStep(
      'capital-property-accepted-notification',
      nt('capitalPropertyAccepted.inApp.subject'),
      nt('capitalPropertyAccepted.inApp.body')
    ),
    createPushStep(
      'capital-property-accepted-push',
      nt('capitalPropertyAccepted.push.subject'),
      nt('capitalPropertyAccepted.push.body')
    ),
  ])
  .build();
