import { NovuService } from '../services/novu.service';
export declare class NotificationController {
    private readonly novuService;
    private readonly logger;
    constructor(novuService: NovuService);
    getHealth(): Promise<{
        status: string;
        timestamp: string;
        service: string;
    }>;
}
