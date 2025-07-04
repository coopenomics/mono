export declare class PushSubscription {
    id: string;
    userId: string;
    endpoint: string;
    p256dhKey: string;
    authKey: string;
    userAgent: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    toWebPushSubscription(): {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    };
}
