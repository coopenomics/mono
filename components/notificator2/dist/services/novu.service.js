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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var NovuService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NovuService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const notifications_1 = require("@coopenomics/notifications");
let NovuService = NovuService_1 = class NovuService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(NovuService_1.name);
        this.config = {
            apiKey: this.configService.get('NOVU_API_KEY') || '',
            apiUrl: this.configService.get('NOVU_API_URL') || 'https://api.novu.co',
        };
        if (!this.config.apiKey) {
            throw new Error('NOVU_API_KEY is required');
        }
        this.client = axios_1.default.create({
            baseURL: this.config.apiUrl,
            headers: {
                'Authorization': `ApiKey ${this.config.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }
    onModuleInit() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log('Инициализация Novu сервиса...');
            yield this.upsertAllWorkflows();
        });
    }
    getWorkflow(workflowId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const response = yield this.client.get(`/v2/workflows/${workflowId}`);
                return response.data;
            }
            catch (error) {
                if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                    return null;
                }
                throw error;
            }
        });
    }
    createWorkflow(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const createData = Object.assign({}, data);
                delete createData.origin;
                const response = yield this.client.post('/v2/workflows', createData);
                return response.data;
            }
            catch (error) {
                this.logger.error(`Ошибка создания воркфлоу ${data.workflowId}:`, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
                throw error;
            }
        });
    }
    updateWorkflow(workflowId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const updateData = Object.assign(Object.assign({}, data), { origin: 'external' });
                const response = yield this.client.put(`/v2/workflows/${workflowId}`, updateData);
                return response.data;
            }
            catch (error) {
                this.logger.error(`Ошибка обновления воркфлоу ${workflowId}:`, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
                throw error;
            }
        });
    }
    upsertWorkflow(workflow) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.logger.log(`Проверяем воркфлоу: ${workflow.workflowId}`);
                const existingWorkflow = yield this.getWorkflow(workflow.workflowId);
                const novuData = {
                    name: workflow.name,
                    workflowId: workflow.workflowId,
                    description: workflow.description,
                    payloadSchema: workflow.payloadSchema,
                    steps: workflow.steps,
                    preferences: workflow.preferences,
                };
                if (existingWorkflow) {
                    this.logger.log(`Обновляем воркфлоу: ${workflow.workflowId}`);
                    return yield this.updateWorkflow(workflow.workflowId, novuData);
                }
                else {
                    this.logger.log(`Создаём воркфлоу: ${workflow.workflowId}`);
                    return yield this.createWorkflow(novuData);
                }
            }
            catch (error) {
                this.logger.error(`Ошибка upsert воркфлоу ${workflow.workflowId}:`, error.message);
                throw error;
            }
        });
    }
    upsertAllWorkflows() {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.log(`Начинаем upsert ${notifications_1.allWorkflows.length} воркфлоу...`);
            for (const workflow of notifications_1.allWorkflows) {
                try {
                    yield this.upsertWorkflow(workflow);
                    this.logger.log(`✓ Воркфлоу ${workflow.workflowId} успешно обработан`);
                }
                catch (error) {
                    this.logger.error(`✗ Ошибка обработки воркфлоу ${workflow.workflowId}:`, error.message);
                }
            }
            this.logger.log('Завершён upsert всех воркфлоу');
        });
    }
    triggerWorkflow(workflowId, subscriberId, payload, email, actor) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const triggerData = {
                    name: workflowId,
                    to: {
                        subscriberId,
                        email,
                    },
                    payload,
                    actor,
                };
                const response = yield this.client.post('/v1/events/trigger', triggerData);
                return response.data;
            }
            catch (error) {
                this.logger.error(`Ошибка триггера воркфлоу ${workflowId}:`, ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
                throw error;
            }
        });
    }
    getHealth() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.client.get('/v1/health-check');
                return response.status === 200;
            }
            catch (_a) {
                return false;
            }
        });
    }
};
exports.NovuService = NovuService;
exports.NovuService = NovuService = NovuService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NovuService);
//# sourceMappingURL=novu.service.js.map