import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

/**
 * Председателю кооперативного участка: пайщик подал заявление о паевом взносе имуществом в участок, заявление ждёт одобрения (задача 99D-30).
 */
export const marketplaceInvestPropertySubmittedPayloadSchema = z.object({
  userName: z.string(),
  investorName: z.string(),
  propertyName: z.string(),
  amount: z.string(),
  branchName: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceInvestPropertySubmittedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceInvestPropertySubmitted.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'vlozhenie-imushchestvom-podano';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceInvestPropertySubmitted')
  .description(nt('marketplaceInvestPropertySubmitted.description'))
  .payloadSchema(marketplaceInvestPropertySubmittedPayloadSchema)
  .tags(['marketplace', 'branch-chairman'])
  .addSteps([
    createEmailStep('marketplace-invest-property-submitted-email', nt('marketplaceInvestPropertySubmitted.email.subject'), nt('marketplaceInvestPropertySubmitted.email.body')),
    createInAppStep('marketplace-invest-property-submitted-notification', nt('marketplaceInvestPropertySubmitted.inApp.subject'), nt('marketplaceInvestPropertySubmitted.inApp.body')),
    createPushStep('marketplace-invest-property-submitted-push', nt('marketplaceInvestPropertySubmitted.push.subject'), nt('marketplaceInvestPropertySubmitted.push.body')),
  ])
  .build();
