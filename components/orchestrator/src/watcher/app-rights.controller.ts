/**
 * @fileoverview Права ядра приложения и сигнал повторной установки — для ядра узла (487-37).
 *
 * Ядро показывает председателю, какие права просит действующая версия
 * приложения, и после согласия просит повторить установку. Права читаются из
 * манифеста версии тем же путём, каким их возьмёт установка: председатель
 * соглашается ровно с тем, что оркестратор заявит ядру.
 */
import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  APPS_CONTRACT_EVENT_STREAM,
  RELEASE_METADATA_PORT,
  type AppsContractEventStreamPort,
  type ReleaseMetadataPort,
} from './ports';

interface AppRightsResponse {
  /** Действующая версия пакета; `null` — выпуска нет либо версия неизвестна. */
  version: string | null;
  ports: string[];
  chain_actions: string[];
}

@Controller('v1/internal/extensions')
export class AppRightsController {
  constructor(
    @Inject(RELEASE_METADATA_PORT) private readonly metadata: ReleaseMetadataPort,
    @Inject(APPS_CONTRACT_EVENT_STREAM) private readonly stream: AppsContractEventStreamPort,
  ) {}

  /** Права ядра, которые просит действующая версия пакета. Пакет без бэкенда прав не просит. */
  @Get('rights/:scope/:name')
  async rights(@Param('scope') scope: string, @Param('name') name: string): Promise<AppRightsResponse> {
    const packageId = packageIdOf(scope, name);
    const [spec, version] = await Promise.all([
      this.metadata.fetchInstallSpec({ packageId, version: '' }),
      this.metadata.latestVersion?.(packageId) ?? Promise.resolve(null),
    ]);
    return {
      version,
      ports: spec?.corePorts?.ports ?? [],
      chain_actions: spec?.corePorts?.chainActions ?? [],
    };
  }

  /** Повторить установку пакета ближайшим опросом: председатель дал согласие на права. */
  @Post('recheck/:scope/:name')
  @HttpCode(200)
  recheck(@Param('scope') scope: string, @Param('name') name: string): { ok: true } {
    this.stream.recheck?.(packageIdOf(scope, name));
    return { ok: true };
  }
}

/** `voskhod` + `exampleapp` → `@voskhod/exampleapp`. */
function packageIdOf(scope: string, name: string): string {
  return `${scope.startsWith('@') ? scope : `@${scope}`}/${name}`;
}
