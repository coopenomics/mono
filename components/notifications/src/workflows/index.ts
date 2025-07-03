import { WorkflowDefinition } from '../types';

// Импортируем все воркфлоу
export * from './welcome';

// Импорты воркфлоу для регистрации
import { welcomeWorkflow } from './welcome';

// Массив всех воркфлоу для автоматической регистрации
export const allWorkflows: WorkflowDefinition[] = [
  welcomeWorkflow,
  // Здесь будут добавляться новые воркфлоу
];

// Экспортируем воркфлоу по ID для удобного доступа
export const workflowsById = allWorkflows.reduce((acc, workflow) => {
  acc[workflow.workflowId] = workflow;
  return acc;
}, {} as Record<string, WorkflowDefinition>);
