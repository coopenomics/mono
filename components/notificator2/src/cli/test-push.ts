#!/usr/bin/env ts-node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fetch from 'node-fetch';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  status?: number;
}

interface TestOptions {
  apiBase?: string;
  userId?: string;
  verbose?: boolean;
}

class NotificatorTestCLI {
  private apiBase: string;
  private verbose: boolean;

  constructor(apiBase: string = 'http://localhost:3000/api', verbose: boolean = false) {
    this.apiBase = apiBase;
    this.verbose = verbose;
  }

  private log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warn: chalk.yellow,
    };
    console.log(colors[type](message));
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
  ): Promise<ApiResponse> {
    const url = `${this.apiBase}${endpoint}`;
    
    if (this.verbose) {
      this.log(`→ ${method} ${url}`, 'info');
      if (data) {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      }
    }

    try {
      const options: any = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (this.verbose) {
        this.log(`← ${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');
        console.log(chalk.gray(JSON.stringify(result, null, 2)));
      }

      return {
        success: response.ok,
        data: result,
        status: response.status,
      };
    } catch (error: any) {
      if (this.verbose) {
        this.log(`✗ ${error.message}`, 'error');
      }
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async testHealthCheck(): Promise<boolean> {
    console.log(chalk.blue('\n🔍 Проверка health check...'));
    const result = await this.makeRequest('GET', '/notifications/health');

    if (result.success) {
      this.log('✅ Health check успешен', 'success');
      return true;
    } else {
      this.log(`❌ Health check неудачен: ${result.error || JSON.stringify(result.data)}`, 'error');
      return false;
    }
  }

  async interactiveMode(): Promise<void> {
    console.log(chalk.green('🧪 Интерактивное тестирование Notificator2\n'));

    const { action } = await inquirer.prompt([
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
      console.log(chalk.yellow('👋 До свидания!'));
      return;
    }

    if (action === 'health') {
      await this.testHealthCheck();
    }
  }
}

// CLI Setup
const program = new Command();

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
  .action(async () => {
    const options = program.opts<TestOptions>();
    const cli = new NotificatorTestCLI(options.apiBase, options.verbose);
    await cli.testHealthCheck();
  });

program
  .command('interactive')
  .alias('i')
  .description('Интерактивный режим')
  .action(async () => {
    const options = program.opts<TestOptions>();
    const cli = new NotificatorTestCLI(options.apiBase, options.verbose);
    await cli.interactiveMode();
  });

// Если команда не указана, запускаем интерактивный режим
if (process.argv.length === 2) {
  const options = program.opts<TestOptions>();
  const cli = new NotificatorTestCLI(options.apiBase, options.verbose);
  cli.interactiveMode().catch(console.error);
} else {
  program.parse();
}
