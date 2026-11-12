import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

/**
 * Инициатору кооперативного участка: доля инициаторов за месяц возместила его
 * паевой взнос, сумма доступна к заявлению о трансляции на главный паевой
 * кошелёк (задача 99D-30). Одно уведомление на проход списания.
 */
export const marketplaceInvestReturnedPayloadSchema = z.object({
  userName: z.string(),
  branchName: z.string(),
  /** Доступно к трансляции сейчас, два знака. */
  amount: z.string(),
  /** Строка состояния: возмещение идёт либо использованное возмещено целиком. */
  status: z.string(),
  coopname: z.string(),
  deepLinkUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof marketplaceInvestReturnedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('marketplaceInvestReturned.name');
// Идентификатор закреплён: на него ссылаются подписки. Не менять.
export const id = 'vlozhenie-vozmeshcheno';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('marketplaceInvestReturned')
  .description(nt('marketplaceInvestReturned.description'))
  .payloadSchema(marketplaceInvestReturnedPayloadSchema)
  .tags(['marketplace', 'orderer'])
  .addSteps([
    createEmailStep('marketplace-invest-returned-email', nt('marketplaceInvestReturned.email.subject'), nt('marketplaceInvestReturned.email.body')),
    createInAppStep('marketplace-invest-returned-notification', nt('marketplaceInvestReturned.inApp.subject'), nt('marketplaceInvestReturned.inApp.body')),
    createPushStep('marketplace-invest-returned-push', nt('marketplaceInvestReturned.push.subject'), nt('marketplaceInvestReturned.push.body')),
  ])
  .build();
