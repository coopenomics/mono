
import { z } from 'zod';
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { BaseWorkflowPayload } from '../../types';

// Схема для welcome воркфлоу
export const welcomePayloadSchema = z.object({
  userName: z.string(),
});
export type IPayload = z.infer<typeof welcomePayloadSchema>;
export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('welcome.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'dobro-pozhalovat';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('welcome')
  .description(nt('welcome.description'))
  .payloadSchema(welcomePayloadSchema)
  .tags(['user']) 
  .addSteps([
    createEmailStep(
      'welcome-email',
      nt('welcome.email.subject'),
      nt('welcome.email.body')
    ),
    createInAppStep(
      'welcome-notification',
      nt('welcome.inApp.subject'),
      nt('welcome.inApp.body')
    ),
    createPushStep(
      'welcome-push',
      nt('welcome.push.subject'),
      nt('welcome.push.body')
    ),
  ])
  .build();