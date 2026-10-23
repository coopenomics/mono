import { WorkflowDefinition, type BaseWorkflowPayload } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep } from '../../base/defaults';
import { nt } from '../../i18n';
import { z } from 'zod';

// Схема для login-email-code воркфлоу (2FA-вход: код подтверждения на почту)
export const loginEmailCodePayloadSchema = z.object({
  /** Одноразовый код подтверждения входа (6 цифр). */
  code: z.string(),
  /** Срок жизни кода человеческим языком («10 минут»). */
  ttl: z.string(),
});

export type IPayload = z.infer<typeof loginEmailCodePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('loginEmailCode.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'kod-podtverzhdeniya-vkhoda';

/**
 * Email-only: код запрашивается ДО входа, in-app канал пайщику ещё недоступен, а
 * оседание кода в Центре уведомлений после входа только путало бы.
 */
export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('loginEmailCode')
  .description(nt('loginEmailCode.description'))
  .payloadSchema(loginEmailCodePayloadSchema)
  .tags(['auth'])
  .addSteps([
    createEmailStep(
      'login-email-code-email',
      nt('loginEmailCode.email.subject'),
      nt('loginEmailCode.email.body')
    ),
  ])
  .build();
