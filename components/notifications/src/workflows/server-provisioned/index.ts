import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Схема для service-provisioned воркфлоу
export const serviceProvisionedPayloadSchema = z.object({
  cooperativeName: z.string(),
  domain: z.string(),
  provisionedAt: z.string(),
});
export type IPayload = z.infer<typeof serviceProvisionedPayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('serverProvisioned.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'tsifrovoy-kooperativ-razvernut';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('serverProvisioned')
  .description(nt('serverProvisioned.description'))
  .payloadSchema(serviceProvisionedPayloadSchema)
  .tags(['digital', 'cooperative', 'deployment', 'provisioning', 'provider'])
  .addSteps([
    createEmailStep(
      'digital-cooperative-deployed-email',
      nt('serverProvisioned.email.subject'),
      nt('serverProvisioned.email.body')
    ),
    createInAppStep(
      'digital-cooperative-deployed-notification',
      nt('serverProvisioned.inApp.subject'),
      nt('serverProvisioned.inApp.body')
    ),
    createPushStep(
      'digital-cooperative-deployed-push',
      nt('serverProvisioned.push.subject'),
      nt('serverProvisioned.push.body')
    ),
  ])
  .build();
