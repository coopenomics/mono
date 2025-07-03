#!/usr/bin/env ts-node
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class NotificatorTestCLI {
    constructor(apiBase = 'http://localhost:3000/api', verbose = false) {
        this.apiBase = apiBase;
        this.verbose = verbose;
    }
    log(message, type = 'info') {
        const colors = {
            info: chalk_1.default.blue,
            success: chalk_1.default.green,
            error: chalk_1.default.red,
            warn: chalk_1.default.yellow,
        };
        console.log(colors[type](message));
    }
    makeRequest(method, endpoint, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.apiBase}${endpoint}`;
            if (this.verbose) {
                this.log(`→ ${method} ${url}`, 'info');
                if (data) {
                    console.log(chalk_1.default.gray(JSON.stringify(data, null, 2)));
                }
            }
            try {
                const options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                };
                if (data) {
                    options.body = JSON.stringify(data);
                }
                const response = yield (0, node_fetch_1.default)(url, options);
                const result = yield response.json();
                if (this.verbose) {
                    this.log(`← ${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');
                    console.log(chalk_1.default.gray(JSON.stringify(result, null, 2)));
                }
                return {
                    success: response.ok,
                    data: result,
                    status: response.status,
                };
            }
            catch (error) {
                if (this.verbose) {
                    this.log(`✗ ${error.message}`, 'error');
                }
                return {
                    success: false,
                    error: error.message,
                };
            }
        });
    }
    testHealthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(chalk_1.default.blue('\n🔍 Проверка health check...'));
            const result = yield this.makeRequest('GET', '/notifications/health');
            if (result.success) {
                this.log('✅ Health check успешен', 'success');
                return true;
            }
            else {
                this.log(`❌ Health check неудачен: ${result.error || JSON.stringify(result.data)}`, 'error');
                return false;
            }
        });
    }
    interactiveMode() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(chalk_1.default.green('🧪 Интерактивное тестирование Notificator2\n'));
            const { action } = yield inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'Выберите действие:',
                    choices: [
                        { name: '🔍 Health check', value: 'health' },
                        { name: '❌ Выход', value: 'exit' },
                    ],
                },
            ]);
            if (action === 'exit') {
                console.log(chalk_1.default.yellow('👋 До свидания!'));
                return;
            }
            if (action === 'health') {
                yield this.testHealthCheck();
            }
        });
    }
}
const program = new commander_1.Command();
program
    .name('notificator2-test')
    .description('CLI для тестирования Notificator2 сервиса')
    .version('1.0.0');
program
    .option('-a, --api-base <url>', 'База API URL', 'http://localhost:3000/api')
    .option('-v, --verbose', 'Подробный вывод');
program
    .command('health')
    .description('Проверить health check')
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    const options = program.opts();
    const cli = new NotificatorTestCLI(options.apiBase, options.verbose);
    yield cli.testHealthCheck();
}));
program
    .command('interactive')
    .alias('i')
    .description('Интерактивный режим')
    .action(() => __awaiter(void 0, void 0, void 0, function* () {
    const options = program.opts();
    const cli = new NotificatorTestCLI(options.apiBase, options.verbose);
    yield cli.interactiveMode();
}));
if (process.argv.length === 2) {
    const options = program.opts();
    const cli = new NotificatorTestCLI(options.apiBase, options.verbose);
    cli.interactiveMode().catch(console.error);
}
else {
    program.parse();
}
//# sourceMappingURL=test-push.js.map