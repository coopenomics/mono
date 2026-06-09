/**
 * @fileoverview Shell-out импл `DockerRunnerPort`. Зовёт `docker` CLI
 * через `child_process.execFile` (без shell-инъекции через `exec`).
 *
 * Зачем CLI, а не dockerode/socket: orchestrator деплоится в
 * tenant-окружении, где доступ к docker.sock даётся compose-mount'ом;
 * CLI работает с тем же сокетом и не тянет лишних зависимостей.
 *
 * Все вызовы получают аргументы массивом — нет конкатенации с
 * пользовательским вводом, командной инъекции нет.
 */
import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DockerRunnerPort } from './ports';

const execFileAsync = promisify(execFile);
const DOCKER_TIMEOUT_MS = 120_000;

@Injectable()
export class ShellDockerRunner implements DockerRunnerPort {
  private readonly logger = new Logger(ShellDockerRunner.name);

  async pullImage(opts: { imageRef: string; bearerToken: string }): Promise<void> {
    /*
     * docker pull использует уже логиненный креденшал-helper; токен
     * прокидывается через переменную окружения DOCKER_AUTH_TOKEN,
     * которую читает per-registry credential helper (см. deploy/).
     * В MWP здесь только pull — login лежит на инфраструктурном
     * скрипте при bootstrap'е orchestrator'а.
     */
    this.logger.log(`docker pull ${opts.imageRef}`);
    await this.run('docker', ['pull', opts.imageRef], {
      DOCKER_AUTH_TOKEN: opts.bearerToken,
    });
  }

  async composeUp(opts: { composeFile: string; serviceName: string }): Promise<void> {
    this.logger.log(`docker compose -f ${opts.composeFile} up -d ${opts.serviceName}`);
    await this.run('docker', [
      'compose',
      '-f',
      opts.composeFile,
      'up',
      '-d',
      opts.serviceName,
    ]);
  }

  async composeDown(opts: { composeFile: string; serviceName: string }): Promise<void> {
    this.logger.log(`docker compose -f ${opts.composeFile} rm -fsv ${opts.serviceName}`);
    await this.run('docker', [
      'compose',
      '-f',
      opts.composeFile,
      'rm',
      '-fsv',
      opts.serviceName,
    ]);
  }

  private async run(cmd: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<void> {
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout: DOCKER_TIMEOUT_MS,
        env: { ...process.env, ...extraEnv },
      });
      if (stdout) this.logger.debug(stdout.trim());
      if (stderr) this.logger.debug(stderr.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`docker ${args[0] ?? ''} failed: ${msg}`);
    }
  }
}
