import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Схема для approval-response воркфлоу
export const approvalResponsePayloadSchema = z.object({
  userName: z.string(),
  approvalStatus: z.enum(['approved', 'declined']),
  approvalStatusText: z.string(),
  /**
   * Человекочитаемое название предмета запроса (заголовок документа одобрения).
   * Показывается пользователю ВМЕСТО `approvalId`: полный sha256 в тексте
   * уведомления ничего не сообщает и ломает вёрстку узких каналов (in-app/push).
   */
  requestTitle: z.string(),
  /** Технический идентификатор запроса (approval_hash). В тексты не подставляем. */
  approvalId: z.string(),
  coopname: z.string(),
  coopShortName: z.string(),
  approvalUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof approvalResponsePayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('approvalResponse.name');
// Идентификатор закреплён: раньше он вычислялся из названия, и правка
// или перевод названия меняли бы его. Не менять — на него ссылаются подписки.
export const id = 'otvet-na-zapros-odobreniya';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('approvalResponse')
  .description(nt('approvalResponse.description'))
  .payloadSchema(approvalResponsePayloadSchema)
  .tags(['user']) // Для всех пользователей
  .addSteps([
    createEmailStep(
      'approval-response-email',
      nt('approvalResponse.email.subject'),
      nt('approvalResponse.email.body')
    ),
    createInAppStep(
      'approval-response-notification',
      nt('approvalResponse.inApp.subject'),
      nt('approvalResponse.inApp.body')
    ),
    createPushStep(
      'approval-response-push',
      nt('approvalResponse.push.subject'),
      nt('approvalResponse.push.body')
    ),
  ])
  .build();
