import { WorkflowDefinition } from '../../types';
import { WorkflowBuilder } from '../../base/workflow-builder';
import { createEmailStep, createInAppStep, createPushStep } from '../../base/defaults';
import { WelcomeWorkflowPayload, welcomePayloadSchema } from './types';

export const welcomeWorkflow: WorkflowDefinition<WelcomeWorkflowPayload> = WorkflowBuilder
  .create<WelcomeWorkflowPayload>()
  .name('Welcome Workflow')
  .workflowId('welcome-workflow')
  .description('Приветственные уведомления для новых пользователей')
  .payloadSchema(welcomePayloadSchema)
  .addSteps([
    createEmailStep(
      'welcome-email',
      'Добро пожаловать, {{payload.userName}}!',
      'Здравствуй, {{payload.userName}}! Ваш email: {{payload.userEmail}}. {{payload.age}}Ваш возраст: {{payload.age}} лет.{{payload.age}}'
    ),
    createInAppStep(
      'welcome-notification',
      'Добро пожаловать в систему',
      'Привет, {{payload.userName}}! Проверьте ваш email {{payload.userEmail}} для получения дополнительной информации.'
    ),
    createPushStep(
      'welcome-push',
      'Добро пожаловать, {{payload.userName}}!',
      'Это приветственное push-уведомление для {{payload.userEmail}}.'
    ),
  ])
  .build();