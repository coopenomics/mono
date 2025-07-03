import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { 
  WorkflowDefinition, 
  BaseWorkflowPayload, 
  NovuWorkflowData,
  allWorkflows 
} from '@coopenomics/notifications';
import { NovuConfig, NovuTriggerRequest, NovuApiResponse } from '../types/novu.types';

@Injectable()
export class NovuService implements OnModuleInit {
  private readonly logger = new Logger(NovuService.name);
  private readonly client: AxiosInstance;
  private readonly config: NovuConfig;

  constructor(private configService: ConfigService) {
    this.config = {
      apiKey: this.configService.get<string>('NOVU_API_KEY') || '',
      apiUrl: this.configService.get<string>('NOVU_API_URL') || 'https://api.novu.co',
    };

    if (!this.config.apiKey) {
      throw new Error('NOVU_API_KEY is required');
    }

    this.client = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Authorization': `ApiKey ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async onModuleInit() {
    this.logger.log('Инициализация Novu сервиса...');
    await this.upsertAllWorkflows();
  }

  /**
   * Получить информацию о воркфлоу
   */
  async getWorkflow(workflowId: string): Promise<any> {
    try {
      const response = await this.client.get(`/v2/workflows/${workflowId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Создать новый воркфлоу
   */
  async createWorkflow(data: NovuWorkflowData): Promise<any> {
    try {
      // Для создания НЕ передаем origin (как в testFramework2.ts)
      const createData = { ...data };
      delete createData.origin;
      
      const response = await this.client.post('/v2/workflows', createData);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Ошибка создания воркфлоу ${data.workflowId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Обновить существующий воркфлоу
   */
  async updateWorkflow(workflowId: string, data: NovuWorkflowData): Promise<any> {
    try {
      // Для обновления ВСЕГДА передаем origin: "external" (как в testFramework2.ts)
      const updateData = { ...data, origin: 'external' as const };
      
      const response = await this.client.put(`/v2/workflows/${workflowId}`, updateData);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Ошибка обновления воркфлоу ${workflowId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Создать или обновить воркфлоу (upsert)
   */
  async upsertWorkflow(workflow: WorkflowDefinition): Promise<any> {
    try {
      this.logger.log(`Проверяем воркфлоу: ${workflow.workflowId}`);
      
      const existingWorkflow = await this.getWorkflow(workflow.workflowId);
      const novuData: NovuWorkflowData = {
        name: workflow.name,
        workflowId: workflow.workflowId,
        description: workflow.description,
        payloadSchema: workflow.payloadSchema,
        steps: workflow.steps,
        preferences: workflow.preferences,
      };

      if (existingWorkflow) {
        this.logger.log(`Обновляем воркфлоу: ${workflow.workflowId}`);
        return await this.updateWorkflow(workflow.workflowId, novuData);
      } else {
        this.logger.log(`Создаём воркфлоу: ${workflow.workflowId}`);
        return await this.createWorkflow(novuData);
      }
    } catch (error: any) {
      this.logger.error(`Ошибка upsert воркфлоу ${workflow.workflowId}:`, error.message);
      throw error;
    }
  }

  /**
   * Создать или обновить все воркфлоу
   */
  async upsertAllWorkflows(): Promise<void> {
    this.logger.log(`Начинаем upsert ${allWorkflows.length} воркфлоу...`);
    
    for (const workflow of allWorkflows) {
      try {
        await this.upsertWorkflow(workflow);
        this.logger.log(`✓ Воркфлоу ${workflow.workflowId} успешно обработан`);
      } catch (error: any) {
        this.logger.error(`✗ Ошибка обработки воркфлоу ${workflow.workflowId}:`, error.message);
      }
    }
    
    this.logger.log('Завершён upsert всех воркфлоу');
  }

  /**
   * Триггернуть воркфлоу
   */
  async triggerWorkflow<T extends BaseWorkflowPayload>(
    workflowId: string,
    subscriberId: string,
    payload: T,
    email?: string,
    actor?: { subscriberId: string; email?: string }
  ): Promise<NovuApiResponse> {
    try {
      const triggerData: NovuTriggerRequest<T> = {
        name: workflowId,
        to: {
          subscriberId,
          email,
        },
        payload,
        actor,
      };

      const response = await this.client.post('/v1/events/trigger', triggerData);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Ошибка триггера воркфлоу ${workflowId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Получить статус здоровья Novu API
   */
  async getHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/health-check');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
