import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Приложение каталога просит права ядра сверх согласия председателя (487-37):
// новая версия не ставится, пока председатель не ответит на странице приложения.
export const appRightsRequestedPayloadSchema = z.object({
  coopShortName: z.string(),
  appTitle: z.string(),
  appUrl: z.string(),
});

export type IPayload = z.infer<typeof appRightsRequestedPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('appRightsRequested.name');
// Идентификатор закреплён: на него ссылаются подписки на уведомления.
export const id = 'prilozhenie-prosit-novye-prava-yadra';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('appRightsRequested')
  .description(nt('appRightsRequested.description'))
  .payloadSchema(appRightsRequestedPayloadSchema)
  .tags(['chairman']) // Согласие на права приложения даёт председатель
  .addSteps([
    createEmailStep(
      'app-rights-requested-email',
      nt('appRightsRequested.email.subject'),
      nt('appRightsRequested.email.body')
    ),
    createInAppStep(
      'app-rights-requested-notification',
      nt('appRightsRequested.inApp.subject'),
      nt('appRightsRequested.inApp.body')
    ),
    createPushStep(
      'app-rights-requested-push',
      nt('appRightsRequested.push.subject'),
      nt('appRightsRequested.push.body')
    ),
  ])
  .build();
