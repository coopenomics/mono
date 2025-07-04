"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomeWorkflow = void 0;
const workflow_builder_1 = require("../../base/workflow-builder");
const defaults_1 = require("../../base/defaults");
const types_1 = require("./types");
exports.welcomeWorkflow = workflow_builder_1.WorkflowBuilder
    .create()
    .name('Welcome Workflow')
    .workflowId('welcome-workflow')
    .description('Приветственные уведомления для новых пользователей')
    .payloadSchema(types_1.welcomePayloadSchema)
    .addSteps([
    (0, defaults_1.createEmailStep)('welcome-email', 'Добро пожаловать, {{payload.userName}}!', 'Здравствуй, {{payload.userName}}! Ваш email: {{payload.userEmail}}. {{payload.age}}Ваш возраст: {{payload.age}} лет.{{payload.age}}'),
    (0, defaults_1.createInAppStep)('welcome-notification', 'Добро пожаловать в систему', 'Привет, {{payload.userName}}! Проверьте ваш email {{payload.userEmail}} для получения дополнительной информации.'),
    (0, defaults_1.createPushStep)('welcome-push', 'Добро пожаловать, {{payload.userName}}!', 'Это приветственное push-уведомление для {{payload.userEmail}}.'),
])
    .build();
