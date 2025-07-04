"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var WebPushService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPushService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const webpush = __importStar(require("web-push"));
const push_subscription_entity_1 = require("../entities/push-subscription.entity");
let WebPushService = WebPushService_1 = class WebPushService {
    constructor(configService, pushSubscriptionRepository) {
        this.configService = configService;
        this.pushSubscriptionRepository = pushSubscriptionRepository;
        this.logger = new common_1.Logger(WebPushService_1.name);
    }
    onModuleInit() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.initializeWebPush();
        });
    }
    initializeWebPush() {
        return __awaiter(this, void 0, void 0, function* () {
            const vapidPublicKey = this.configService.get('VAPID_PUBLIC_KEY');
            const vapidPrivateKey = this.configService.get('VAPID_PRIVATE_KEY');
            const vapidSubject = this.configService.get('VAPID_SUBJECT') || 'mailto:admin@coopenomics.io';
            if (!vapidPublicKey || !vapidPrivateKey) {
                this.logger.warn('VAPID ключи не настроены. Генерирую новые...');
                yield this.generateVapidKeys();
                return;
            }
            webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
            this.logger.log('Web-push сервис инициализирован с существующими VAPID ключами');
        });
    }
    generateVapidKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            const vapidKeys = webpush.generateVAPIDKeys();
            this.logger.log('Сгенерированы новые VAPID ключи:');
            this.logger.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
            this.logger.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
            this.logger.warn('ВНИМАНИЕ: Добавьте эти ключи в переменные окружения и перезапустите сервис!');
            const vapidSubject = this.configService.get('VAPID_SUBJECT') || 'mailto:admin@coopenomics.io';
            webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);
        });
    }
    getVapidPublicKey() {
        return this.configService.get('VAPID_PUBLIC_KEY') || '';
    }
    saveSubscription(userId, subscription, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingSubscription = yield this.pushSubscriptionRepository.findOne({
                where: { endpoint: subscription.endpoint }
            });
            if (existingSubscription) {
                existingSubscription.userId = userId;
                existingSubscription.p256dhKey = subscription.keys.p256dh;
                existingSubscription.authKey = subscription.keys.auth;
                existingSubscription.userAgent = userAgent;
                existingSubscription.isActive = true;
                return yield this.pushSubscriptionRepository.save(existingSubscription);
            }
            const newSubscription = this.pushSubscriptionRepository.create({
                userId,
                endpoint: subscription.endpoint,
                p256dhKey: subscription.keys.p256dh,
                authKey: subscription.keys.auth,
                userAgent,
                isActive: true,
            });
            return yield this.pushSubscriptionRepository.save(newSubscription);
        });
    }
    removeSubscription(endpoint) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pushSubscriptionRepository.update({ endpoint }, { isActive: false });
        });
    }
    getUserSubscriptions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pushSubscriptionRepository.find({
                where: { userId, isActive: true }
            });
        });
    }
    sendNotificationToUser(userId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptions = yield this.getUserSubscriptions(userId);
            if (subscriptions.length === 0) {
                this.logger.warn(`Нет активных push подписок для пользователя ${userId}`);
                return;
            }
            yield this.sendNotificationToSubscriptions(subscriptions, payload);
        });
    }
    sendNotificationToSubscriptions(subscriptions, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = subscriptions.map((subscription) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const webPushSubscription = subscription.toWebPushSubscription();
                    yield webpush.sendNotification(webPushSubscription, JSON.stringify(payload), {
                        TTL: 24 * 60 * 60,
                        urgency: 'normal',
                        topic: payload.tag,
                    });
                    this.logger.debug(`Push уведомление отправлено: ${subscription.endpoint.substring(0, 50)}...`);
                }
                catch (error) {
                    this.logger.error(`Ошибка отправки push уведомления для подписки ${subscription.id}:`, error.message);
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        yield this.pushSubscriptionRepository.update({ id: subscription.id }, { isActive: false });
                        this.logger.warn(`Подписка ${subscription.id} деактивирована (endpoint недоступен)`);
                    }
                }
            }));
            yield Promise.allSettled(promises);
        });
    }
    sendNotificationToAll(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscriptions = yield this.pushSubscriptionRepository.find({
                where: { isActive: true }
            });
            if (subscriptions.length === 0) {
                this.logger.warn('Нет активных push подписок');
                return;
            }
            this.logger.log(`Отправка push уведомления ${subscriptions.length} подпискам`);
            yield this.sendNotificationToSubscriptions(subscriptions, payload);
        });
    }
    getSubscriptionStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const total = yield this.pushSubscriptionRepository.count();
            const active = yield this.pushSubscriptionRepository.count({
                where: { isActive: true }
            });
            const inactive = total - active;
            const uniqueUsers = yield this.pushSubscriptionRepository
                .createQueryBuilder('subscription')
                .select('COUNT(DISTINCT subscription.userId)', 'count')
                .where('subscription.isActive = :isActive', { isActive: true })
                .getRawOne();
            return {
                total,
                active,
                inactive,
                uniqueUsers: parseInt(uniqueUsers.count),
            };
        });
    }
    cleanupInactiveSubscriptions() {
        return __awaiter(this, arguments, void 0, function* (olderThanDays = 30) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            const result = yield this.pushSubscriptionRepository
                .createQueryBuilder()
                .delete()
                .where('isActive = :isActive AND updatedAt < :cutoffDate', {
                isActive: false,
                cutoffDate
            })
                .execute();
            const deletedCount = result.affected || 0;
            this.logger.log(`Очищено ${deletedCount} неактивных подписок старше ${olderThanDays} дней`);
            return deletedCount;
        });
    }
};
exports.WebPushService = WebPushService;
exports.WebPushService = WebPushService = WebPushService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(push_subscription_entity_1.PushSubscription)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], WebPushService);
//# sourceMappingURL=web-push.service.js.map