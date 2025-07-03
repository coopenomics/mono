"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var NovuWebPushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovuWebPushService = void 0;
const common_1 = require("@nestjs/common");
const web_push_service_1 = require("./web-push.service");
let NovuWebPushService = NovuWebPushService_1 = class NovuWebPushService {
    constructor(webPushService) {
        this.webPushService = webPushService;
        this.logger = new common_1.Logger(NovuWebPushService_1.name);
    }
    sendWebPushFromNovu(userId, payload, workflowId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const notificationPayload = {
                    title: payload.title,
                    body: payload.body,
                    icon: payload.icon || '/icons/default-icon.png',
                    badge: payload.badge || '/icons/badge.png',
                    image: payload.image,
                    data: Object.assign(Object.assign({}, payload.data), { url: payload.url, workflowId, timestamp: Date.now() }),
                    actions: (_a = payload.actions) === null || _a === void 0 ? void 0 : _a.map(action => ({
                        action: action.action,
                        title: action.title,
                        icon: action.icon,
                    })),
                    tag: payload.tag,
                    requireInteraction: payload.requireInteraction,
                    silent: payload.silent,
                    timestamp: Date.now(),
                    vibrate: payload.vibrate,
                };
                yield this.webPushService.sendNotificationToUser(userId, notificationPayload);
                this.logger.log(`Web-push уведомление отправлено через NOVU для пользователя ${userId}, workflow: ${workflowId}`);
            }
            catch (error) {
                this.logger.error(`Ошибка отправки web-push через NOVU для пользователя ${userId}:`, error.message);
                throw error;
            }
        });
    }
    getWebPushIntegrationConfig() {
        const vapidPublicKey = this.webPushService.getVapidPublicKey();
        return {
            name: 'Web Push (Custom)',
            identifier: 'web-push-custom',
            logoFileName: 'web-push.png',
            channel: 'push',
            credentials: [
                {
                    key: 'publicKey',
                    displayName: 'VAPID Public Key',
                    type: 'string',
                    required: true,
                    value: vapidPublicKey,
                },
                {
                    key: 'privateKey',
                    displayName: 'VAPID Private Key',
                    type: 'secret',
                    required: true,
                },
                {
                    key: 'subject',
                    displayName: 'VAPID Subject',
                    type: 'string',
                    required: true,
                    value: 'mailto:admin@coopenomics.io',
                },
            ],
            docReference: 'https://developer.mozilla.org/en-US/docs/Web/API/Push_API',
            comingSoon: false,
            betaVersion: false,
            nesting: false,
            supportedFeatures: {
                digest: true,
                delay: true,
                title: true,
                body: true,
                avatar: true,
                actions: true,
            },
        };
    }
    syncUserSubscriptionsWithNovu(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const subscriptions = yield this.webPushService.getUserSubscriptions(userId);
                this.logger.log(`Синхронизированы подписки для пользователя ${userId}: ${subscriptions.length} активных`);
                return {
                    userId,
                    subscriptionsCount: subscriptions.length,
                    syncedAt: new Date(),
                };
            }
            catch (error) {
                this.logger.error(`Ошибка синхронизации подписок для пользователя ${userId}:`, error.message);
                throw error;
            }
        });
    }
};
exports.NovuWebPushService = NovuWebPushService;
exports.NovuWebPushService = NovuWebPushService = NovuWebPushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [web_push_service_1.WebPushService])
], NovuWebPushService);
//# sourceMappingURL=novu-webpush.service.js.map