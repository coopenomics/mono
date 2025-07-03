import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { 
  WorkflowDefinition, 
  BaseWorkflowPayload, 
  WorkflowStep, 
  PayloadSchema,
  NovuWorkflowData,
  NovuOrigin 
} from '../types';
import { createDefaultPreferences } from './defaults';

export class WorkflowBuilder<T extends BaseWorkflowPayload> {
  private _name: string = '';
  private _workflowId: string = '';
  private _description?: string;
  private _steps: WorkflowStep[] = [];
  private _payloadZodSchema?: z.ZodSchema<T>;
  private _origin?: NovuOrigin;

  static create<T extends BaseWorkflowPayload>(): WorkflowBuilder<T> {
    return new WorkflowBuilder<T>();
  }

  name(name: string): this {
    this._name = name;
    return this;
  }

  workflowId(id: string): this {
    this._workflowId = id;
    return this;
  }

  description(description: string): this {
    this._description = description;
    return this;
  }

  origin(origin: NovuOrigin): this {
    this._origin = origin;
    return this;
  }

  addStep(step: WorkflowStep): this {
    this._steps.push(step);
    return this;
  }

  addSteps(steps: WorkflowStep[]): this {
    this._steps.push(...steps);
    return this;
  }

  payloadSchema(schema: z.ZodSchema<T>): this {
    this._payloadZodSchema = schema;
    return this;
  }

  build(): WorkflowDefinition<T> {
    if (!this._name) throw new Error('Workflow name is required');
    if (!this._workflowId) throw new Error('Workflow ID is required');
    if (!this._payloadZodSchema) throw new Error('Payload schema is required');

    // Преобразуем Zod схему в JSON Schema для Novu
    const jsonSchema = zodToJsonSchema(this._payloadZodSchema);
    
    // Правильная типизация: zodToJsonSchema может вернуть разные типы схем
    const payloadSchema: PayloadSchema = {
      type: (jsonSchema as any).type || 'object',
      properties: (jsonSchema as any).properties || {},
      required: Array.isArray((jsonSchema as any).required) ? (jsonSchema as any).required : [],
    };

    const workflow: WorkflowDefinition<T> = {
      name: this._name,
      workflowId: this._workflowId,
      description: this._description,
      payloadSchema,
      steps: this._steps,
      preferences: createDefaultPreferences(),
      payloadZodSchema: this._payloadZodSchema,
    };

    // Добавляем origin только если он указан
    if (this._origin) {
      workflow.origin = this._origin;
    }

    return workflow;
  }

  // Конвертация в формат для Novu API
  toNovuData(): NovuWorkflowData {
    const workflow = this.build();
    const novuData: NovuWorkflowData = {
      name: workflow.name,
      workflowId: workflow.workflowId,
      description: workflow.description,
      payloadSchema: workflow.payloadSchema,
      steps: workflow.steps,
      preferences: workflow.preferences,
    };

    // Добавляем origin только если он указан
    if (workflow.origin) {
      novuData.origin = workflow.origin;
    }

    return novuData;
  }
}
