import { WebPushService } from './web-push.service';
export interface NovuWebPushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    url?: string;
    data?: any;
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
        url?: string;
    }>;
    tag?: string;
    requireInteraction?: boolean;
    silent?: boolean;
    vibrate?: number[];
}
export declare class NovuWebPushService {
    private readonly webPushService;
    private readonly logger;
    constructor(webPushService: WebPushService);
    sendWebPushFromNovu(userId: string, payload: NovuWebPushPayload, workflowId?: string): Promise<void>;
    getWebPushIntegrationConfig(): {
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
    syncUserSubscriptionsWithNovu(userId: string): Promise<{
        userId: string;
        subscriptionsCount: number;
        syncedAt: Date;
    }>;
}
