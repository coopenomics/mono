import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const chatcoopCalendarEventUpdatedPayloadSchema = z.object({
  coopShortName: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string(),
  endTime: z.string(),
  timezone: z.string(),
  roomLabel: z.string(),
  eventUrl: z.string(),
  actorUsername: z.string(),
});

export type IPayload = z.infer<typeof chatcoopCalendarEventUpdatedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('chatcoopCalendarEventUpdated.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'uvedomlenie-ob-izmenenii-sobytiya-kalendarya-kooperativa';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('chatcoopCalendarEventUpdated')
  .description(nt('chatcoopCalendarEventUpdated.description'))
  .payloadSchema(chatcoopCalendarEventUpdatedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'chatcoop-cal-updated-email',
      nt('chatcoopCalendarEventUpdated.email.subject'),
      nt('chatcoopCalendarEventUpdated.email.body')
    ),
    createInAppStep(
      'chatcoop-cal-updated-inapp',
      nt('chatcoopCalendarEventUpdated.inApp.subject'),
      nt('chatcoopCalendarEventUpdated.inApp.body')
    ),
    createPushStep(
      'chatcoop-cal-updated-push',
      nt('chatcoopCalendarEventUpdated.push.subject'),
      nt('chatcoopCalendarEventUpdated.push.body')
    ),
  ])
  .build();
