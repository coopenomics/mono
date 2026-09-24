
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для meet-reminder-start воркфлоу
export const meetReminderStartPayloadSchema = z.object({
  coopShortName: z.string(),
  meetId: z.number(),
  meetDate: z.string(),
  meetTime: z.string(),
  timeDescription: z.string(),
  meetUrl: z.string(),
  details: z.string().optional(),
});

export type IPayload = z.infer<typeof meetReminderStartPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('meetReminderStart.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'napominanie-o-predstoyaschem-sobranii';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('meetReminderStart')
  .description(nt('meetReminderStart.description'))
  .payloadSchema(meetReminderStartPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'meet-reminder-start-email',
      nt('meetReminderStart.email.subject'),
      nt('meetReminderStart.email.body')
    ),
    createInAppStep(
      'meet-reminder-start-notification',
      nt('meetReminderStart.inApp.subject'),
      nt('meetReminderStart.inApp.body')
    ),
    createPushStep(
      'meet-reminder-start-push',
      nt('meetReminderStart.push.subject'),
      nt('meetReminderStart.push.body')
    ),
  ])
  .build();

