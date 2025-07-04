import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkflowDefinition, BaseWorkflowPayload, NovuWorkflowData } from '@coopenomics/notifications';
import { NovuApiResponse } from '../types/novu.types';
export declare class NovuService implements OnModuleInit {
    private configService;
    private readonly logger;
    private readonly client;
    private readonly config;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    getWorkflow(workflowId: string): Promise<any>;
    createWorkflow(data: NovuWorkflowData): Promise<any>;
    updateWorkflow(workflowId: string, data: NovuWorkflowData): Promise<any>;
    upsertWorkflow(workflow: WorkflowDefinition): Promise<any>;
    upsertAllWorkflows(): Promise<void>;
    triggerWorkflow<T extends BaseWorkflowPayload>(workflowId: string, subscriberId: string, payload: T, email?: string, actor?: {
        subscriberId: string;
        email?: string;
    }): Promise<NovuApiResponse>;
    getHealth(): Promise<boolean>;
}
