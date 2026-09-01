import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { z } from 'zod';
import { slugify } from '../../utils';

// Схема для login-email-code воркфлоу (2FA-вход: код подтверждения на почту)
export const loginEmailCodePayloadSchema = z.object({
  /** Одноразовый код подтверждения входа (6 цифр). */
  code: z.string(),
  /** Срок жизни кода человеческим языком («10 минут»). */
  ttl: z.string(),
});

export type IPayload = z.infer<typeof loginEmailCodePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Код подтверждения входа';
export const id = slugify(name);

/**
 * Email-only: код запрашивается ДО входа, in-app канал пайщику ещё недоступен, а
 * оседание кода в Центре уведомлений после входа только путало бы.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Одноразовый код на почту для подтверждения входа (двухфакторная аутентификация)')
  .payloadSchema(loginEmailCodePayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'login-email-code-email',
      'Код подтверждения входа: {{payload.code}}',
      'Вы входите в свой аккаунт. Код подтверждения:<br><br>' +
      '<strong style="font-size:24px;letter-spacing:4px">{{payload.code}}</strong><br><br>' +
      'Код действует {{payload.ttl}} и работает только для этой попытки входа.<br>' +
      'Если вход выполняете не вы — не сообщайте код никому и смените пароль.'
    ),
  ])
  .build();
