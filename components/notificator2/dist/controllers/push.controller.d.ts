import { WebPushService, PushSubscriptionData } from '../services/web-push.service';
export interface SubscribePushDto {
    userId: string;
    subscription: PushSubscriptionData;
}
export interface SendNotificationDto {
    userId?: string;
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    data?: any;
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
    tag?: string;
    requireInteraction?: boolean;
    silent?: boolean;
    vibrate?: number[];
}
export declare class PushController {
    private readonly webPushService;
    private readonly logger;
    constructor(webPushService: WebPushService);
    getVapidPublicKey(): {
        publicKey: string;
        applicationServerKey: string;
    };
    subscribe(dto: SubscribePushDto, userAgent?: string): Promise<{
        success: boolean;
        message: string;
        subscriptionId: string;
    }>;
    unsubscribe(body: {
        endpoint: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    getUserSubscriptions(userId: string): Promise<{
        success: boolean;
        data: {
            id: string;
            endpoint: string;
            userAgent: string;
            createdAt: Date;
            isActive: boolean;
        }[];
    }>;
    sendNotification(dto: SendNotificationDto): Promise<{
        success: boolean;
        message: string;
    }>;
    sendTestNotification(userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getStats(): Promise<{
        success: boolean;
        data: {
            total: number;
            active: number;
            inactive: number;
            uniqueUsers: number;
        };
    }>;
    cleanup(days?: string): Promise<{
        success: boolean;
        message: string;
        deletedCount: number;
    }>;
    private validateSubscription;
    private validateNotificationPayload;
}
