import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';
import { birthdayGreetingPayloadSchema } from '../birthday-greeting';

/**
 * Информационная рассылка кооператива всем действующим пайщикам: праздник,
 * объявление. Текст пишет председатель в шаблоне приложения «Информационные рассылки»;
 * приложение передаёт готовые тему и очищенный HTML, поэтому данные те же,
 * что у поздравления с днём рождения. Реклама этим сценарием не отправляется.
 */
export const informationalMailingPayloadSchema = birthdayGreetingPayloadSchema;

export type IPayload = z.infer<typeof informationalMailingPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('informationalMailing.name');
// Идентификатор закреплён: на него ссылаются подписки и журнал уведомлений. Не менять.
export const id = 'informatsionnaya-rassylka';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder.create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('informationalMailing')
  .description(nt('informationalMailing.description'))
  .payloadSchema(informationalMailingPayloadSchema)
  .tags(['user'])
  .addSteps([
    createEmailStep('informational-mailing-email', nt('informationalMailing.email.subject'), nt('informationalMailing.email.body')),
    createInAppStep('informational-mailing-inapp', nt('informationalMailing.inApp.subject'), nt('informationalMailing.inApp.body')),
  ])
  .build();
