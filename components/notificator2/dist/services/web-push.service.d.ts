import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';
export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export interface NotificationPayload {
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
    timestamp?: number;
    vibrate?: number[];
}
export declare class WebPushService implements OnModuleInit {
    private configService;
    private pushSubscriptionRepository;
    private readonly logger;
    constructor(configService: ConfigService, pushSubscriptionRepository: Repository<PushSubscription>);
    onModuleInit(): Promise<void>;
    private initializeWebPush;
    private generateVapidKeys;
    getVapidPublicKey(): string;
    saveSubscription(userId: string, subscription: PushSubscriptionData, userAgent?: string): Promise<PushSubscription>;
    removeSubscription(endpoint: string): Promise<void>;
    getUserSubscriptions(userId: string): Promise<PushSubscription[]>;
    sendNotificationToUser(userId: string, payload: NotificationPayload): Promise<void>;
    sendNotificationToSubscriptions(subscriptions: PushSubscription[], payload: NotificationPayload): Promise<void>;
    sendNotificationToAll(payload: NotificationPayload): Promise<void>;
    getSubscriptionStats(): Promise<{
        total: number;
        active: number;
        inactive: number;
        uniqueUsers: number;
    }>;
    cleanupInactiveSubscriptions(olderThanDays?: number): Promise<number>;
}
