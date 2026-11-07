import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

/**
 * Вносящему пайщику: совет решил по заявлению о паевом взносе имуществом в кооперативный участок; при приёме — подписать акт (задача 99D-30).
 */
export const marketplaceInvestPropertyDecidedPayloadSchema = z.object({
  userName: z.string(),
  propertyName: z.string(),
  branchName: z.string(),
  decision: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceInvestPropertyDecidedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceInvestPropertyDecided.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'vlozhenie-imushchestvom-reshenie';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceInvestPropertyDecided')
  .description(nt('marketplaceInvestPropertyDecided.description'))
  .payloadSchema(marketplaceInvestPropertyDecidedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep('marketplace-invest-property-decided-email', nt('marketplaceInvestPropertyDecided.email.subject'), nt('marketplaceInvestPropertyDecided.email.body')),
    createInAppStep('marketplace-invest-property-decided-notification', nt('marketplaceInvestPropertyDecided.inApp.subject'), nt('marketplaceInvestPropertyDecided.inApp.body')),
    createPushStep('marketplace-invest-property-decided-push', nt('marketplaceInvestPropertyDecided.push.subject'), nt('marketplaceInvestPropertyDecided.push.body')),
  ])
  .build();
