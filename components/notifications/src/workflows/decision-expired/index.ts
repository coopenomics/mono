import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для decision-expired воркфлоу
export const decisionExpiredPayloadSchema = z.object({
  userName: z.string(),
  decisionTitle: z.string(),
  coopname: z.string(),
  decision_id: z.string(),
  short_abbr: z.string(),
  name: z.string(),
});

export type IPayload = z.infer<typeof decisionExpiredPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('decisionExpired.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'reshenie-soveta-ne-prinyato-po-istecheniyu-sroka';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('decisionExpired')
  .description(nt('decisionExpired.description'))
  .payloadSchema(decisionExpiredPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'decision-expired-email',
      nt('decisionExpired.email.subject'),
      nt('decisionExpired.email.body')
    ),
    createInAppStep(
      'decision-expired-notification',
      nt('decisionExpired.inApp.subject'),
      nt('decisionExpired.inApp.body')
    ),
    createPushStep(
      'decision-expired-push',
      nt('decisionExpired.push.subject'),
      nt('decisionExpired.push.body')
    ),
  ])
  .build();