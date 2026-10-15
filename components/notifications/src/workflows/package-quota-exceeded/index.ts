import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { nt } from '../../i18n';

// Epic 13 v5.1 — кооператив упёрся в месячную квоту докупки пакетов
// документооборота: AXON исчерпан, а провайдер отказал hub-cron'у в выписке
// очередного package-invoice (quota_exceeded). Чтобы продолжить работу в этом
// месяце, кооперативу нужно поднять квоту (редактируемый параметр тарифа).
export const packageQuotaExceededPayloadSchema = z.object({
  coopName: z.string(), // отображаемое имя кооператива-пайщика
  quotaRub: z.string(), // действующая месячная квота, ₽
  spentRub: z.string(), // уже потрачено на пакеты в этом месяце, ₽
  packagePriceRub: z.string(), // цена одного пакета, ₽
  settingsUrl: z.string().optional(),
});

export type IPayload = z.infer<typeof packageQuotaExceededPayloadSchema>;

export interface IWorkflow extends BaseWorkflowPayload, IPayload {}

export const name = nt('packageQuotaExceeded.name');
// Идентификатор закреплён: на него ссылаются подписки и провайдер
// (billing-workflows.ts). Не менять.
export const id = 'kvota-paketov-dokumentooborota-ischerpana';

export const workflow: WorkflowDefinition<IWorkflow> = WorkflowBuilder
  .create<IWorkflow>()
  .name(name)
  .workflowId(id)
  .i18nKey('packageQuotaExceeded')
  .description(nt('packageQuotaExceeded.description'))
  .payloadSchema(packageQuotaExceededPayloadSchema)
  .tags(['billing'])
  .addSteps([
    createEmailStep('package-quota-exceeded-email', nt('packageQuotaExceeded.email.subject'), nt('packageQuotaExceeded.email.body')),
    createInAppStep('package-quota-exceeded-in-app', nt('packageQuotaExceeded.inApp.subject'), nt('packageQuotaExceeded.inApp.body')),
    createPushStep('package-quota-exceeded-push', nt('packageQuotaExceeded.push.subject'), nt('packageQuotaExceeded.push.body')),
  ])
  .build();
