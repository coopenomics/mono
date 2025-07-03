"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowBuilder = void 0;
const zod_to_json_schema_1 = require("zod-to-json-schema");
const defaults_1 = require("./defaults");
class WorkflowBuilder {
    constructor() {
        this._name = '';
        this._workflowId = '';
        this._steps = [];
    }
    static create() {
        return new WorkflowBuilder();
    }
    name(name) {
        this._name = name;
        return this;
    }
    workflowId(id) {
        this._workflowId = id;
        return this;
    }
    description(description) {
        this._description = description;
        return this;
    }
    origin(origin) {
        this._origin = origin;
        return this;
    }
    addStep(step) {
        this._steps.push(step);
        return this;
    }
    addSteps(steps) {
        this._steps.push(...steps);
        return this;
    }
    payloadSchema(schema) {
        this._payloadZodSchema = schema;
        return this;
    }
    build() {
        if (!this._name)
            throw new Error('Workflow name is required');
        if (!this._workflowId)
            throw new Error('Workflow ID is required');
        if (!this._payloadZodSchema)
            throw new Error('Payload schema is required');
        // Преобразуем Zod схему в JSON Schema для Novu
        const jsonSchema = (0, zod_to_json_schema_1.zodToJsonSchema)(this._payloadZodSchema);
        // Правильная типизация: zodToJsonSchema может вернуть разные типы схем
        const payloadSchema = {
            type: jsonSchema.type || 'object',
            properties: jsonSchema.properties || {},
            required: Array.isArray(jsonSchema.required) ? jsonSchema.required : [],
        };
        const workflow = {
            name: this._name,
            workflowId: this._workflowId,
            description: this._description,
            payloadSchema,
            steps: this._steps,
            preferences: (0, defaults_1.createDefaultPreferences)(),
            payloadZodSchema: this._payloadZodSchema,
        };
        // Добавляем origin только если он указан
        if (this._origin) {
            workflow.origin = this._origin;
        }
        return workflow;
    }
    // Конвертация в формат для Novu API
    toNovuData() {
        const workflow = this.build();
        const novuData = {
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
exports.WorkflowBuilder = WorkflowBuilder;
