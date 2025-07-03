import { BaseWorkflowPayload } from '@coopenomics/notifications';

export interface NovuConfig {
  apiKey: string;
  apiUrl: string;
}

export interface NovuTriggerRequest<T extends BaseWorkflowPayload> {
  name: string;
  to: {
    subscriberId: string;
    email?: string;
  };
  payload: T;
  actor?: {
    subscriberId: string;
    email?: string;
  };
}

export interface NovuApiResponse {
  data?: any;
  error?: string;
  acknowledged?: boolean;
  status?: string;
  transactionId?: string;
}
