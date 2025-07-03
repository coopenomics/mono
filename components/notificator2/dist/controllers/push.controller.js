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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
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
var PushController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushController = void 0;
const common_1 = require("@nestjs/common");
const web_push_service_1 = require("../services/web-push.service");
let PushController = PushController_1 = class PushController {
    constructor(webPushService) {
        this.webPushService = webPushService;
        this.logger = new common_1.Logger(PushController_1.name);
    }
    getVapidPublicKey() {
        const publicKey = this.webPushService.getVapidPublicKey();
        if (!publicKey) {
            throw new common_1.BadRequestException('VAPID ключи не настроены. Проверьте конфигурацию сервера.');
        }
        return {
            publicKey,
            applicationServerKey: publicKey,
        };
    }
    subscribe(dto, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateSubscription(dto.subscription);
                const subscription = yield this.webPushService.saveSubscription(dto.userId, dto.subscription, userAgent);
                this.logger.log(`Пользователь ${dto.userId} подписался на push уведомления`);
                return {
                    success: true,
                    message: 'Подписка на push уведомления успешно создана',
                    subscriptionId: subscription.id,
                };
            }
            catch (error) {
                this.logger.error('Ошибка при подписке на push уведомления:', error.message);
                throw new common_1.BadRequestException(error.message);
            }
        });
    }
    unsubscribe(body) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!body.endpoint) {
                    throw new common_1.BadRequestException('Endpoint обязателен для отписки');
                }
                yield this.webPushService.removeSubscription(body.endpoint);
                this.logger.log(`Подписка отключена: ${body.endpoint.substring(0, 50)}...`);
                return {
                    success: true,
                    message: 'Подписка успешно отключена',
                };
            }
            catch (error) {
                this.logger.error('Ошибка при отписке от push уведомлений:', error.message);
                throw new common_1.BadRequestException(error.message);
            }
        });
    }
    getUserSubscriptions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptions = yield this.webPushService.getUserSubscriptions(userId);
            return {
                success: true,
                data: subscriptions.map(sub => ({
                    id: sub.id,
                    endpoint: sub.endpoint.substring(0, 50) + '...',
                    userAgent: sub.userAgent,
                    createdAt: sub.createdAt,
                    isActive: sub.isActive,
                })),
            };
        });
    }
    sendNotification(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.validateNotificationPayload(dto);
                const payload = {
                    title: dto.title,
                    body: dto.body,
                    icon: dto.icon,
                    badge: dto.badge,
                    image: dto.image,
                    data: dto.data,
                    actions: dto.actions,
                    tag: dto.tag,
                    requireInteraction: dto.requireInteraction,
                    silent: dto.silent,
                    timestamp: Date.now(),
                    vibrate: dto.vibrate,
                };
                if (dto.userId) {
                    yield this.webPushService.sendNotificationToUser(dto.userId, payload);
                    this.logger.log(`Push уведомление отправлено пользователю ${dto.userId}`);
                }
                else {
                    yield this.webPushService.sendNotificationToAll(payload);
                    this.logger.log('Push уведомление отправлено всем пользователям');
                }
                return {
                    success: true,
                    message: dto.userId
                        ? `Уведомление отправлено пользователю ${dto.userId}`
                        : 'Уведомление отправлено всем пользователям',
                };
            }
            catch (error) {
                this.logger.error('Ошибка при отправке push уведомления:', error.message);
                throw new common_1.BadRequestException(error.message);
            }
        });
    }
    sendTestNotification(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = {
                title: '🔔 Тестовое уведомление',
                body: 'Ваши push уведомления работают корректно!',
                icon: '/icons/notification-icon.png',
                badge: '/icons/badge-icon.png',
                tag: 'test-notification',
                data: {
                    type: 'test',
                    timestamp: Date.now(),
                },
                actions: [
                    {
                        action: 'view',
                        title: 'Открыть приложение',
                    },
                    {
                        action: 'dismiss',
                        title: 'Закрыть',
                    },
                ],
            };
            yield this.webPushService.sendNotificationToUser(userId, payload);
            return {
                success: true,
                message: `Тестовое уведомление отправлено пользователю ${userId}`,
            };
        });
    }
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const stats = yield this.webPushService.getSubscriptionStats();
            return {
                success: true,
                data: stats,
            };
        });
    }
    cleanup(days) {
        return __awaiter(this, void 0, void 0, function* () {
            const olderThanDays = days ? parseInt(days) : 30;
            if (isNaN(olderThanDays) || olderThanDays < 1) {
                throw new common_1.BadRequestException('Параметр days должен быть положительным числом');
            }
            const deletedCount = yield this.webPushService.cleanupInactiveSubscriptions(olderThanDays);
            return {
                success: true,
                message: `Очищено ${deletedCount} неактивных подписок старше ${olderThanDays} дней`,
                deletedCount,
            };
        });
    }
    validateSubscription(subscription) {
        var _a, _b;
        if (!subscription.endpoint) {
            throw new Error('Endpoint подписки обязателен');
        }
        if (!((_a = subscription.keys) === null || _a === void 0 ? void 0 : _a.p256dh) || !((_b = subscription.keys) === null || _b === void 0 ? void 0 : _b.auth)) {
            throw new Error('Ключи p256dh и auth обязательны');
        }
        try {
            new URL(subscription.endpoint);
        }
        catch (_c) {
            throw new Error('Невалидный endpoint URL');
        }
    }
    validateNotificationPayload(dto) {
        var _a, _b;
        if (!((_a = dto.title) === null || _a === void 0 ? void 0 : _a.trim())) {
            throw new Error('Заголовок уведомления обязателен');
        }
        if (!((_b = dto.body) === null || _b === void 0 ? void 0 : _b.trim())) {
            throw new Error('Текст уведомления обязателен');
        }
        if (dto.title.length > 100) {
            throw new Error('Заголовок уведомления не должен превышать 100 символов');
        }
        if (dto.body.length > 500) {
            throw new Error('Текст уведомления не должен превышать 500 символов');
        }
    }
};
exports.PushController = PushController;
__decorate([
    (0, common_1.Get)('vapid-public-key'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PushController.prototype, "getVapidPublicKey", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "subscribe", null);
__decorate([
    (0, common_1.Delete)('unsubscribe'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "unsubscribe", null);
__decorate([
    (0, common_1.Get)('subscriptions/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "getUserSubscriptions", null);
__decorate([
    (0, common_1.Post)('send'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "sendNotification", null);
__decorate([
    (0, common_1.Post)('test/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "sendTestNotification", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PushController.prototype, "getStats", null);
__decorate([
    (0, common_1.Delete)('cleanup'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "cleanup", null);
exports.PushController = PushController = PushController_1 = __decorate([
    (0, common_1.Controller)('push'),
    __metadata("design:paramtypes", [web_push_service_1.WebPushService])
], PushController);
//# sourceMappingURL=push.controller.js.map