/**
 * @fileoverview Мост между REST-эндпоинтом force-refresh и dynamic
 * supergraph manager'ом.
 *
 * Manager создаётся внутри `supergraphSdl`-hook'а Apollo Gateway, т.е.
 * вне Nest DI. Чтобы `POST /v1/internal/composition/refresh` мог дёрнуть
 * немедленный recompose, hook регистрирует manager здесь, а контроллер
 * инжектит этот singleton.
 */
import { Injectable } from '@nestjs/common';
import type { SupergraphManagerLifecycle } from './supergraph-manager';

export interface RefreshOutcome {
  /** false — gateway ещё не поднял manager (bootstrap не завершён). */
  ready: boolean;
  /** true — registry изменился и supergraph пересобран. */
  recomposed: boolean;
  /** Сообщение ошибки composer'а, если recompose упал. */
  error?: string;
}

@Injectable()
export class SupergraphRefreshService {
  private manager?: Pick<SupergraphManagerLifecycle, 'forceRefresh' | 'forceRecompose'>;

  attach(manager: Pick<SupergraphManagerLifecycle, 'forceRefresh' | 'forceRecompose'>): void {
    this.manager = manager;
  }

  /**
   * @param force — пересобрать схему, даже если состав реестра не изменился:
   *   контейнер приложения заменён (новая версия), его схема могла измениться.
   */
  async trigger(force = false): Promise<RefreshOutcome> {
    if (this.manager === undefined) {
      return { ready: false, recomposed: false };
    }
    try {
      if (force) {
        await this.manager.forceRecompose();
        return { ready: true, recomposed: true };
      }
      return { ready: true, recomposed: await this.manager.forceRefresh() };
    } catch (e) {
      return {
        ready: true,
        recomposed: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
