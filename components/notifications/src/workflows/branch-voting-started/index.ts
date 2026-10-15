import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для branch-voting-started воркфлоу
export const branchVotingStartedPayloadSchema = z.object({
  coopShortName: z.string(),
  meetPlace: z.string(),
  closeAtTime: z.string(),
  meetingUrl: z.string(),
});

export type IPayload = z.infer<typeof branchVotingStartedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('branchVotingStarted.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'golosovanie-sobraniya-uchastka-nachalos';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('branchVotingStarted')
  .description(nt('branchVotingStarted.description'))
  .payloadSchema(branchVotingStartedPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep(
      'branch-voting-started-email',
      nt('branchVotingStarted.email.subject'),
      nt('branchVotingStarted.email.body')
    ),
    createInAppStep(
      'branch-voting-started-notification',
      nt('branchVotingStarted.inApp.subject'),
      nt('branchVotingStarted.inApp.body')
    ),
    createPushStep(
      'branch-voting-started-push',
      nt('branchVotingStarted.push.subject'),
      nt('branchVotingStarted.push.body')
    ),
  ])
  .build();
