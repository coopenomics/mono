
import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для meet-initial воркфлоу
export const meetInitialPayloadSchema = z.object({
  coopShortName: z.string(),
  meetId: z.number(),
  meetDate: z.string(),
  meetTime: z.string(),
  meetEndDate: z.string(),
  meetEndTime: z.string(),
  timezone: z.string(),
  meetUrl: z.string(),
  details: z.string().optional(),
});

export type IPayload = z.infer<typeof meetInitialPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('meetInitial.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'uvedomlenie-o-novom-obschem-sobranii';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('meetInitial')
  .description(nt('meetInitial.description'))
  .payloadSchema(meetInitialPayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'meet-initial-email',
      nt('meetInitial.email.subject'),
      nt('meetInitial.email.body')
    ),
    createInAppStep(
      'meet-initial-notification',
      nt('meetInitial.inApp.subject'),
      nt('meetInitial.inApp.body')
    ),
    createPushStep(
      'meet-initial-push',
      nt('meetInitial.push.subject'),
      nt('meetInitial.push.body')
    ),
  ])
  .build();

