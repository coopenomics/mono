import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

export const chatcoopCalendarEventCreatedPayloadSchema = z.object({
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

export type IPayload = z.infer<typeof chatcoopCalendarEventCreatedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('chatcoopCalendarEventCreated.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'uvedomlenie-o-novom-sobytii-kalendarya-kooperativa';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('chatcoopCalendarEventCreated')
  .description(nt('chatcoopCalendarEventCreated.description'))
  .payloadSchema(chatcoopCalendarEventCreatedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'chatcoop-cal-created-email',
      nt('chatcoopCalendarEventCreated.email.subject'),
      nt('chatcoopCalendarEventCreated.email.body')
    ),
    createInAppStep(
      'chatcoop-cal-created-inapp',
      nt('chatcoopCalendarEventCreated.inApp.subject'),
      nt('chatcoopCalendarEventCreated.inApp.body')
    ),
    createPushStep(
      'chatcoop-cal-created-push',
      nt('chatcoopCalendarEventCreated.push.subject'),
      nt('chatcoopCalendarEventCreated.push.body')
    ),
  ])
  .build();
