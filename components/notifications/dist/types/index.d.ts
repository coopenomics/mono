import { z } from 'zod';
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
export interface BaseWorkflowPayload {
    [key: string]: any;
}
export interface PayloadSchema {
    type: string;
    properties: Record<string, any>;
    required: string[];
}
export type NovuOrigin = 'novu-cloud' | 'novu-cloud-v1' | 'external';
export interface WorkflowDefinition<T extends BaseWorkflowPayload = BaseWorkflowPayload> {
    name: string;
    workflowId: string;
    description?: string;
    payloadSchema: PayloadSchema;
    steps: WorkflowStep[];
    preferences: PreferencesConfig;
    origin?: NovuOrigin;
    payloadZodSchema: z.ZodSchema<T>;
}
export interface NovuWorkflowData {
    name: string;
    workflowId: string;
    description?: string;
    payloadSchema: PayloadSchema;
    steps: WorkflowStep[];
    preferences: PreferencesConfig;
    origin?: NovuOrigin;
}
export interface WorkflowTriggerData<T extends BaseWorkflowPayload> {
    workflowId: string;
    subscriberId: string;
    payload: T;
    actor?: {
        subscriberId: string;
        email?: string;
    };
}
export type WorkflowStepType = WorkflowStep['type'];
export type ChannelType = keyof ChannelsConfig;
