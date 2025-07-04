import { z } from 'zod';
import { BaseWorkflowPayload } from '../../types';
export declare const welcomePayloadSchema: z.ZodObject<{
    userName: z.ZodString;
    userEmail: z.ZodString;
    age: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    userName: string;
    userEmail: string;
    age?: number | undefined;
}, {
    userName: string;
    userEmail: string;
    age?: number | undefined;
}>;
export type WelcomePayload = z.infer<typeof welcomePayloadSchema>;
export interface WelcomeWorkflowPayload extends BaseWorkflowPayload, WelcomePayload {
}
