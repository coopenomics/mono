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
var NovuWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovuWebhookController = void 0;
const common_1 = require("@nestjs/common");
const novu_webpush_service_1 = require("../services/novu-webpush.service");
const web_push_service_1 = require("../services/web-push.service");
let NovuWebhookController = NovuWebhookController_1 = class NovuWebhookController {
    constructor(novuWebPushService, webPushService) {
        this.novuWebPushService = novuWebPushService;
        this.webPushService = webPushService;
        this.logger = new common_1.Logger(NovuWebhookController_1.name);
    }
    handlePushWebhook(payload, signature) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            try {
                this.logger.log(`Получен NOVU webhook: ${payload.event} для пользователя ${payload.data.subscriber.subscriberId}`);
                if (!this.isValidWebhook(payload, signature)) {
                    throw new common_1.BadRequestException('Невалидный webhook');
                }
                if (payload.data.step.type !== 'push') {
                    this.logger.warn(`Пропускаем событие ${payload.event} с типом ${payload.data.step.type}`);
                    return { success: true, message: 'Событие пропущено (не push)' };
                }
                const userId = payload.data.subscriber.subscriberId;
                const workflowId = payload.data.workflow.id;
                const pushPayload = {
                    title: this.extractTemplateValue((_a = payload.data.step.template.content) === null || _a === void 0 ? void 0 : _a.title, payload.data.payload),
                    body: this.extractTemplateValue((_b = payload.data.step.template.content) === null || _b === void 0 ? void 0 : _b.body, payload.data.payload),
                    icon: this.extractTemplateValue((_c = payload.data.step.template.content) === null || _c === void 0 ? void 0 : _c.icon, payload.data.payload),
                    badge: this.extractTemplateValue((_d = payload.data.step.template.content) === null || _d === void 0 ? void 0 : _d.badge, payload.data.payload),
                    image: this.extractTemplateValue((_e = payload.data.step.template.content) === null || _e === void 0 ? void 0 : _e.image, payload.data.payload),
                    url: this.extractTemplateValue((_g = (_f = payload.data.step.template.content) === null || _f === void 0 ? void 0 : _f.data) === null || _g === void 0 ? void 0 : _g.url, payload.data.payload),
                    tag: this.extractTemplateValue((_h = payload.data.step.template.content) === null || _h === void 0 ? void 0 : _h.tag, payload.data.payload),
                    requireInteraction: (_j = payload.data.step.template.content) === null || _j === void 0 ? void 0 : _j.requireInteraction,
                    silent: (_k = payload.data.step.template.content) === null || _k === void 0 ? void 0 : _k.silent,
                    data: Object.assign(Object.assign({}, payload.data.payload), { workflowId, webhookId: payload.webhookId }),
                };
                yield this.novuWebPushService.sendWebPushFromNovu(userId, pushPayload, workflowId);
                return {
                    success: true,
                    message: `Push уведомление отправлено пользователю ${userId}`,
                    workflowId,
                    userId,
                };
            }
            catch (error) {
                this.logger.error('Ошибка обработки NOVU webhook:', error.message);
                throw new common_1.BadRequestException(error.message);
            }
        });
    }
    subscribeViaNovu(body) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, subscription, email } = body;
                yield this.webPushService.saveSubscription(userId, subscription);
                yield this.novuWebPushService.syncUserSubscriptionsWithNovu(userId);
                this.logger.log(`Пользователь ${userId} подписался через NOVU интеграцию`);
                return {
                    success: true,
                    message: 'Подписка создана и синхронизирована с NOVU',
                    userId,
                    email,
                };
            }
            catch (error) {
                this.logger.error('Ошибка подписки через NOVU:', error.message);
                throw new common_1.BadRequestException(error.message);
            }
        });
    }
    getIntegrationConfig() {
        return this.novuWebPushService.getWebPushIntegrationConfig();
    }
    testWebhook(body) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId, title = '🧪 Тест webhook', body: msgBody = 'Тестовое уведомление через webhook' } = body;
            const testPayload = {
                title,
                body: msgBody,
                icon: '/icons/test-icon.png',
                badge: '/icons/badge.png',
                url: '/dashboard',
                tag: 'webhook-test',
                data: {
                    type: 'webhook-test',
                    timestamp: Date.now(),
                },
            };
            try {
                yield this.novuWebPushService.sendWebPushFromNovu(userId, testPayload, 'test-webhook');
                return {
                    success: true,
                    message: `Тестовое уведомление отправлено пользователю ${userId}`,
                    userId,
                };
            }
            catch (error) {
                this.logger.error('Ошибка теста webhook:', error.message);
                throw new common_1.BadRequestException(error.message);
            }
        });
    }
    isValidWebhook(payload, signature) {
        return !!(payload &&
            payload.data &&
            payload.data.subscriber &&
            payload.data.subscriber.subscriberId &&
            payload.data.workflow &&
            payload.data.step);
    }
    extractTemplateValue(template, payload) {
        if (!template || typeof template !== 'string') {
            return template;
        }
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return payload[key] || match;
        });
    }
};
exports.NovuWebhookController = NovuWebhookController;
__decorate([
    (0, common_1.Post)('webhook/push'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('x-novu-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NovuWebhookController.prototype, "handlePushWebhook", null);
__decorate([
    (0, common_1.Post)('subscribe'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NovuWebhookController.prototype, "subscribeViaNovu", null);
__decorate([
    (0, common_1.Get)('integration/config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NovuWebhookController.prototype, "getIntegrationConfig", null);
__decorate([
    (0, common_1.Post)('test'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NovuWebhookController.prototype, "testWebhook", null);
exports.NovuWebhookController = NovuWebhookController = NovuWebhookController_1 = __decorate([
    (0, common_1.Controller)('novu'),
    __metadata("design:paramtypes", [novu_webpush_service_1.NovuWebPushService,
        web_push_service_1.WebPushService])
], NovuWebhookController);
//# sourceMappingURL=novu-webhook.controller.js.map