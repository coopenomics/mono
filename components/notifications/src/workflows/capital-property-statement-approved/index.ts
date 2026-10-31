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

export const name = nt('capitalPropertyStatementApproved.name');
// Идентификатор закреплён: на него ссылаются подписки, название может меняться.
export const id = 'predsedatel-odobril-vznos-imushchestvom';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('capitalPropertyStatementApproved')
  .description(nt('capitalPropertyStatementApproved.description'))
  .payloadSchema(payloadSchema)
  .tags(['capital', 'contributor'])
  .addSteps([
    createEmailStep(
      'capital-property-statement-approved-email',
      nt('capitalPropertyStatementApproved.email.subject'),
      nt('capitalPropertyStatementApproved.email.body')
    ),
    createInAppStep(
      'capital-property-statement-approved-notification',
      nt('capitalPropertyStatementApproved.inApp.subject'),
      nt('capitalPropertyStatementApproved.inApp.body')
    ),
    createPushStep(
      'capital-property-statement-approved-push',
      nt('capitalPropertyStatementApproved.push.subject'),
      nt('capitalPropertyStatementApproved.push.body')
    ),
  ])
  .build();
