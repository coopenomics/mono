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
var CleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const web_push_service_1 = require("./web-push.service");
let CleanupService = CleanupService_1 = class CleanupService {
    constructor(webPushService) {
        this.webPushService = webPushService;
        this.logger = new common_1.Logger(CleanupService_1.name);
    }
    cleanupInactiveSubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Запуск автоматической очистки неактивных push подписок...');
            try {
                const deletedCount = yield this.webPushService.cleanupInactiveSubscriptions(30);
                this.logger.log(`Автоматическая очистка завершена. Удалено ${deletedCount} неактивных подписок.`);
            }
            catch (error) {
                this.logger.error('Ошибка автоматической очистки:', error.message);
            }
        });
    }
    logWeeklyStats() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Генерация еженедельной статистики push подписок...');
            try {
                const stats = yield this.webPushService.getSubscriptionStats();
                this.logger.log(`📊 Еженедельная статистика push подписок:`);
                this.logger.log(`   Всего подписок: ${stats.total}`);
                this.logger.log(`   Активных: ${stats.active}`);
                this.logger.log(`   Неактивных: ${stats.inactive}`);
                this.logger.log(`   Уникальных пользователей: ${stats.uniqueUsers}`);
                const activePercentage = stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : '0';
                this.logger.log(`   Процент активных подписок: ${activePercentage}%`);
            }
            catch (error) {
                this.logger.error('Ошибка генерации статистики:', error.message);
            }
        });
    }
    manualCleanup(olderThanDays) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log(`Запуск ручной очистки подписок старше ${olderThanDays} дней...`);
            try {
                const deletedCount = yield this.webPushService.cleanupInactiveSubscriptions(olderThanDays);
                this.logger.log(`Ручная очистка завершена. Удалено ${deletedCount} неактивных подписок.`);
                return deletedCount;
            }
            catch (error) {
                this.logger.error('Ошибка ручной очистки:', error.message);
                throw error;
            }
        });
    }
};
exports.CleanupService = CleanupService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_2AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CleanupService.prototype, "cleanupInactiveSubscriptions", null);
__decorate([
    (0, schedule_1.Cron)('0 12 * * 0'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CleanupService.prototype, "logWeeklyStats", null);
exports.CleanupService = CleanupService = CleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [web_push_service_1.WebPushService])
], CleanupService);
//# sourceMappingURL=cleanup.service.js.map