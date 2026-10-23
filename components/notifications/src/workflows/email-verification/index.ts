import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема для email-verification воркфлоу
export const emailVerificationPayloadSchema = z.object({
  /** Шестизначный код подтверждения. */
  code: z.string(),
  /** Срок действия кода человеческими словами («15 минут»). */
  ttl: z.string(),
});

export type IPayload = z.infer<typeof emailVerificationPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('emailVerification.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'verifikatsiya-email';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('emailVerification')
  .description(nt('emailVerification.description'))
  .payloadSchema(emailVerificationPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'email-verification-email',
      nt('emailVerification.email.subject'),
      nt('emailVerification.email.body')
    ),
  ])
  .build();
