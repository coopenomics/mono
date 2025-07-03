import { z } from 'zod';
import { WorkflowDefinition, BaseWorkflowPayload, WorkflowStep, NovuWorkflowData, NovuOrigin } from '../types';
export declare class WorkflowBuilder<T extends BaseWorkflowPayload> {
    private _name;
    private _workflowId;
    private _description?;
    private _steps;
    private _payloadZodSchema?;
    private _origin?;
    static create<T extends BaseWorkflowPayload>(): WorkflowBuilder<T>;
    name(name: string): this;
    workflowId(id: string): this;
    description(description: string): this;
    origin(origin: NovuOrigin): this;
    addStep(step: WorkflowStep): this;
    addSteps(steps: WorkflowStep[]): this;
    payloadSchema(schema: z.ZodSchema<T>): this;
    build(): WorkflowDefinition<T>;
    toNovuData(): NovuWorkflowData;
}
