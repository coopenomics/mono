import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { z } from 'zod';
import { slugify } from '../../utils';

// Схема для email-verification воркфлоу
export const emailVerificationPayloadSchema = z.object({
  /** Шестизначный код подтверждения. */
  code: z.string(),
  /** Срок действия кода человеческими словами («15 минут»). */
  ttl: z.string(),
});

export type IPayload = z.infer<typeof emailVerificationPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Верификация Email';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Верификация email адреса пользователя')
  .payloadSchema(emailVerificationPayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'email-verification-email',
      'Код подтверждения почты',
      'Подтвердите, что этот адрес принадлежит вам.<br><br>' +
      'Код подтверждения: <b style="font-size:20px;letter-spacing:3px">{{payload.code}}</b><br><br>' +
      'Введите его на странице, где запрашивалось подтверждение. Время действия кода - {{payload.ttl}}.<br><br>' +
      'Подтверждённая почта нужна, чтобы вы могли вернуть доступ к личному кабинету и получать уведомления кооператива.<br><br>' +
      'Если вы не запрашивали подтверждение - проигнорируйте это сообщение.'
    ),
  ])
  .build();
