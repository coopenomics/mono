import { z } from 'zod';

// Базовые типы для каналов уведомлений
export interface ChannelConfig {
  enabled: boolean;
  readOnly?: boolean;
}

export interface ChannelsConfig {
  email: ChannelConfig;
  sms: ChannelConfig;
  in_app: ChannelConfig;
  push: ChannelConfig;
  chat: ChannelConfig;
}

export interface PreferencesConfig {
  user: {
    all: ChannelConfig;
    channels: ChannelsConfig;
  };
  workflow: {
    all: ChannelConfig;
    channels: ChannelsConfig;
  };
}

// Базовые типы для шагов воркфлоу
export interface StepControlValues {
  subject?: string;
  body?: string;
  title?: string;
  content?: string;
  avatar?: string;
  editorType?: 'html' | 'text';
  [key: string]: any;
}

export interface WorkflowStep {
  name: string;
  type: 'email' | 'sms' | 'in_app' | 'push' | 'chat' | 'delay' | 'digest';
  controlValues: StepControlValues;
}

// Базовый интерфейс для payload воркфлоу
export interface BaseWorkflowPayload {
  [key: string]: any;
}

// Интерфейс для схемы payload (JSON Schema)
export interface PayloadSchema {
  type: string;
  properties: Record<string, any>;
  required: string[];
}

// Допустимые значения для origin в Novu
export type NovuOrigin = 'novu-cloud' | 'novu-cloud-v1' | 'external';

// Главный интерфейс для воркфлоу
export interface WorkflowDefinition<T extends BaseWorkflowPayload = BaseWorkflowPayload> {
  name: string;
  workflowId: string;
  description?: string;
  payloadSchema: PayloadSchema;
  steps: WorkflowStep[];
  preferences: PreferencesConfig;
  origin?: NovuOrigin; // Делаем optional
  // Типизированная схема для валидации payload
  payloadZodSchema: z.ZodSchema<T>;
}

// Интерфейс для создания воркфлоу в Novu (без origin для создания)
export interface NovuWorkflowData {
  name: string;
  workflowId: string;
  description?: string;
  payloadSchema: PayloadSchema;
  steps: WorkflowStep[];
  preferences: PreferencesConfig;
  origin?: NovuOrigin; // Optional - только для обновлений
}

// Интерфейс для триггера воркфлоу
export interface WorkflowTriggerData<T extends BaseWorkflowPayload> {
  workflowId: string;
  subscriberId: string;
  payload: T;
  actor?: {
    subscriberId: string;
    email?: string;
  };
}

// Утилитарные типы
export type WorkflowStepType = WorkflowStep['type'];
export type ChannelType = keyof ChannelsConfig;
