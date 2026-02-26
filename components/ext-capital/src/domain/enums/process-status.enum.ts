export enum ProcessTemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum ProcessInstanceStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ProcessStepStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
