
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для meet-restart воркфлоу
export const meetRestartPayloadSchema = z.object({
  coopShortName: z.string(),
  meetId: z.number(),
  meetDate: z.string(),
  meetTime: z.string(),
  meetEndDate: z.string(),
  meetEndTime: z.string(),
  timezone: z.string(),
  meetUrl: z.string(),
});

export type IPayload = z.infer<typeof meetRestartPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('meetRestart.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'naznachena-novaya-data-povtornogo-sobraniya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('meetRestart')
  .description(nt('meetRestart.description'))
  .payloadSchema(meetRestartPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'meet-restart-email',
      nt('meetRestart.email.subject'),
      nt('meetRestart.email.body')
    ),
    createInAppStep(
      'meet-restart-notification',
      nt('meetRestart.inApp.subject'),
      nt('meetRestart.inApp.body')
    ),
    createPushStep(
      'meet-restart-push',
      nt('meetRestart.push.subject'),
      nt('meetRestart.push.body')
    ),
  ])
  .build();

