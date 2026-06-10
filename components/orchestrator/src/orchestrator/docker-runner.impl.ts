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
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { DockerRunnerPort } from './ports';

const execFileAsync = promisify(execFile);
const DOCKER_TIMEOUT_MS = 120_000;

/**
 * Хост registry из OCI image ref: `registry.host/scope/name:tag` →
 * `registry.host`. Если первый сегмент не похож на хост (нет `.`/`:`),
 * ref указывает на Docker Hub — логиниться в наш CA-контур бессмысленно.
 */
export function registryHostOf(imageRef: string): string | null {
  const first = imageRef.split('/')[0] ?? '';
  return first.includes('.') || first.includes(':') ? first : null;
}

@Injectable()
export class ShellDockerRunner implements DockerRunnerPort {
  private readonly logger = new Logger(ShellDockerRunner.name);

  async pullImage(opts: { imageRef: string; username: string; password: string }): Promise<void> {
    /*
     * Авторизация — через изолированный DOCKER_CONFIG (временный каталог),
     * чтобы не трогать host-level ~/.docker/config.json. `docker login`
     * кладёт туда Basic-credentials; на pull docker получает 401 +
     * WWW-Authenticate от registry (ca-auth), идёт в его token endpoint
     * с этими credentials и дальше пуллит с Bearer'ом — стандартный
     * OCI Distribution token flow.
     */
    const host = registryHostOf(opts.imageRef);
    if (host === null) {
      throw new Error(`docker pull: imageRef '${opts.imageRef}' без явного registry-хоста не поддерживается`);
    }
    const configDir = await mkdtemp(join(tmpdir(), 'orch-docker-'));
    try {
      this.logger.log(`docker login ${host} + pull ${opts.imageRef}`);
      await this.run(
        'docker',
        ['login', host, '--username', opts.username, '--password-stdin'],
        { DOCKER_CONFIG: configDir },
        opts.password,
      );
      await this.run('docker', ['pull', opts.imageRef], { DOCKER_CONFIG: configDir });
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
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

  async runContainer(opts: {
    imageRef: string;
    name: string;
    network?: string;
    env?: Record<string, string>;
  }): Promise<void> {
    // Замещаем существующий контейнер с тем же именем: это и retry после
    // падения, и обновление версии одним и тем же путём.
    await this.removeContainer(opts.name);
    const args = ['run', '-d', '--restart', 'unless-stopped', '--name', opts.name];
    if (opts.network) {
      args.push('--network', opts.network);
    }
    for (const [key, value] of Object.entries(opts.env ?? {})) {
      args.push('-e', `${key}=${value}`);
    }
    args.push(opts.imageRef);
    this.logger.log(`docker run -d --name ${opts.name} ${opts.imageRef}`);
    await this.run('docker', args);
  }

  async removeContainer(name: string): Promise<void> {
    try {
      await this.run('docker', ['rm', '-f', name]);
    } catch {
      // контейнера нет — нормальное состояние первого запуска
    }
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

  private async run(
    cmd: string,
    args: string[],
    extraEnv: NodeJS.ProcessEnv = {},
    stdin?: string,
  ): Promise<void> {
    try {
      const promise = execFileAsync(cmd, args, {
        timeout: DOCKER_TIMEOUT_MS,
        env: { ...process.env, ...extraEnv },
      });
      if (stdin !== undefined && promise.child.stdin) {
        promise.child.stdin.write(stdin);
        promise.child.stdin.end();
      }
      const { stdout, stderr } = await promise;
      if (stdout) this.logger.debug(stdout.trim());
      if (stderr) this.logger.debug(stderr.trim());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`docker ${args[0] ?? ''} failed: ${msg}`);
    }
  }
}
