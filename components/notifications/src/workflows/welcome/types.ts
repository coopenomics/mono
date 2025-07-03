import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';

// Схема для welcome воркфлоу
export const welcomePayloadSchema = z.object({
  userName: z.string(),
  userEmail: z.string().email(),
  age: z.number().optional(),
});

export type WelcomePayload = z.infer<typeof welcomePayloadSchema>;

export interface WelcomeWorkflowPayload extends BaseWorkflowPayload, WelcomePayload {}
