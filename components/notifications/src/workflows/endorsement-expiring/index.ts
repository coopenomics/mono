import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { slugify } from '../../utils';

// Заверение кооператива в цепочке доверия подходит к концу срока. Пока оно
// действует, удостоверения пайщиков проходят проверку; как только истечёт —
// проверяющий увидит, что принадлежность кооператива к цепочке не подтверждена.
export const endorsementExpiringPayloadSchema = z.object({
  chairmanName: z.string(),
  short_abbr: z.string(),
  name: z.string(),
  daysLeft: z.string(),
  expiresAt: z.string(),
});

export type IPayload = z.infer<typeof endorsementExpiringPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = 'Заверение кооператива в цепочке доверия истекает';
export const id = slugify(name);

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .description('Предупреждение председателю о том, что признание кооператива в цепочке доверия скоро закончится и удостоверения пайщиков перестанут подтверждаться')
  .payloadSchema(endorsementExpiringPayloadSchema)
  .tags(['chairman'])
  .addSteps([
    createEmailStep(
      'endorsement-expiring-email',
      'Заверение {{payload.short_abbr}} {{payload.name}} истекает через {{payload.daysLeft}} дн.',
      'Уважаемый {{payload.chairmanName}}!<br><br>Признание {{payload.short_abbr}} {{payload.name}} в цепочке доверия действует до {{payload.expiresAt}} — осталось {{payload.daysLeft}} дн.<br><br>Пока оно действует, удостоверения пайщиков проходят проверку. После истечения удостоверения продолжат выпускаться, но проверяющий увидит, что принадлежность кооператива к цепочке не подтверждена.<br><br>Продлить заверение может только тот, кто его выдал.'
    ),
    createInAppStep(
      'endorsement-expiring-notification',
      'Заверение истекает',
      'Признание {{payload.short_abbr}} {{payload.name}} в цепочке доверия действует до {{payload.expiresAt}} — осталось {{payload.daysLeft}} дн.'
    ),
    createPushStep(
      'endorsement-expiring-push',
      'Заверение истекает',
      'Признание в цепочке доверия действует до {{payload.expiresAt}} — осталось {{payload.daysLeft}} дн.'
    ),
  ])
  .build();
