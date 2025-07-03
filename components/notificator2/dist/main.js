"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        const logger = new common_1.Logger('Bootstrap');
        const app = yield core_1.NestFactory.create(app_module_1.AppModule);
        app.enableCors({
            origin: process.env.CORS_ORIGIN || '*',
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            credentials: true,
        });
        app.setGlobalPrefix('api');
        const port = process.env.PORT || 3000;
        yield app.listen(port);
        logger.log(`🚀 Приложение запущено на http://localhost:${port}`);
        logger.log(`📡 API доступно на http://localhost:${port}/api`);
    });
}
bootstrap().catch((error) => {
    console.error('Ошибка запуска приложения:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map