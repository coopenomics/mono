"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPushModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const web_push_service_1 = require("../services/web-push.service");
const novu_webpush_service_1 = require("../services/novu-webpush.service");
const cleanup_service_1 = require("../services/cleanup.service");
const push_controller_1 = require("../controllers/push.controller");
const novu_webhook_controller_1 = require("../controllers/novu-webhook.controller");
const push_subscription_entity_1 = require("../entities/push-subscription.entity");
const novu_service_1 = require("../services/novu.service");
let WebPushModule = class WebPushModule {
};
exports.WebPushModule = WebPushModule;
exports.WebPushModule = WebPushModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forFeature([push_subscription_entity_1.PushSubscription]),
        ],
        controllers: [push_controller_1.PushController, novu_webhook_controller_1.NovuWebhookController],
        providers: [web_push_service_1.WebPushService, novu_webpush_service_1.NovuWebPushService, novu_service_1.NovuService, cleanup_service_1.CleanupService],
        exports: [web_push_service_1.WebPushService, novu_webpush_service_1.NovuWebPushService],
    })
], WebPushModule);
//# sourceMappingURL=web-push.module.js.map