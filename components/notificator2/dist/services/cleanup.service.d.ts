import { WebPushService } from './web-push.service';
export declare class CleanupService {
    private readonly webPushService;
    private readonly logger;
    constructor(webPushService: WebPushService);
    cleanupInactiveSubscriptions(): Promise<void>;
    logWeeklyStats(): Promise<void>;
    manualCleanup(olderThanDays: number): Promise<number>;
}
