import { NovuWebPushService } from '../services/novu-webpush.service';
import { WebPushService } from '../services/web-push.service';
export interface NovuWebhookPayload {
    event: string;
    data: {
        subscriber: {
            subscriberId: string;
            email?: string;
        };
        workflow: {
            id: string;
            name: string;
        };
        step: {
            type: string;
            template: any;
        };
        payload: any;
    };
    webhookId: string;
    timestamp: string;
}
export declare class NovuWebhookController {
    private readonly novuWebPushService;
    private readonly webPushService;
    private readonly logger;
    constructor(novuWebPushService: NovuWebPushService, webPushService: WebPushService);
    handlePushWebhook(payload: NovuWebhookPayload, signature?: string): Promise<{
        success: boolean;
        message: string;
        workflowId?: undefined;
        userId?: undefined;
    } | {
        success: boolean;
        message: string;
        workflowId: string;
        userId: string;
    }>;
    subscribeViaNovu(body: {
        userId: string;
        subscription: any;
        email?: string;
    }): Promise<{
        success: boolean;
        message: string;
        userId: string;
        email: string;
    }>;
    getIntegrationConfig(): {
        name: string;
        identifier: string;
        logoFileName: string;
        channel: string;
        credentials: ({
            key: string;
            displayName: string;
            type: string;
            required: boolean;
            value: string;
        } | {
            key: string;
            displayName: string;
            type: string;
            required: boolean;
            value?: undefined;
        })[];
        docReference: string;
        comingSoon: boolean;
        betaVersion: boolean;
        nesting: boolean;
        supportedFeatures: {
            digest: boolean;
            delay: boolean;
            title: boolean;
            body: boolean;
            avatar: boolean;
            actions: boolean;
        };
    };
    testWebhook(body: {
        userId: string;
        title?: string;
        body?: string;
    }): Promise<{
        success: boolean;
        message: string;
        userId: string;
    }>;
    private isValidWebhook;
    private extractTemplateValue;
}
