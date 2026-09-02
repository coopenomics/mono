/**
 * Ведение потока authentik шаг за шагом (задача 105-30).
 *
 * Стол спрашивает текущий шаг, показывает его своими экранами и отправляет ответ. Всё, что
 * делает вход входом, остаётся у authentik; здесь — разговор и то, что видно человеку.
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import {
  FlowStage,
  FlowUnavailable,
  executeFlow,
  formError,
  type FlowAnswer,
  type FlowChallenge,
} from 'src/shared/api/authentik-flow';

export enum FlowState {
  Starting = 'starting',
  Running = 'running',
  Leaving = 'leaving',
  Broken = 'broken',
}

export interface FlowRunner {
  state: Ref<FlowState>;
  challenge: Ref<FlowChallenge | null>;
  sending: Ref<boolean>;
  failure: ComputedRef<string | null>;
  start(): Promise<void>;
  answer(payload: FlowAnswer): Promise<void>;
  /** Принимает готовый шаг, пришедший внутри другого (выбор источника входа). */
  take(next: FlowChallenge): Promise<void>;
}

/** Стадии без экрана: ответ на них пустой. */
const SILENT: ReadonlySet<string> = new Set([FlowStage.UserLogin]);

export const createFlowRunner = (
  base: string,
  slug: string,
  query: string,
  go: (url: string) => void = (url) => window.location.assign(url),
): FlowRunner => {
  const state = ref<FlowState>(FlowState.Starting);
  const challenge = ref<FlowChallenge | null>(null);
  const sending = ref(false);
  const broken = ref<string | null>(null);

  const settle = async (next: FlowChallenge): Promise<void> => {
    challenge.value = next;
    if (next.component === FlowStage.Redirect) {
      state.value = FlowState.Leaving;
      if (next.to) go(next.to);
      return;
    }
    if (SILENT.has(next.component)) {
      await send({ component: next.component });
      return;
    }
    state.value = FlowState.Running;
  };

  const fail = (error: unknown): void => {
    broken.value = error instanceof FlowUnavailable ? error.message : 'Вход не отвечает';
    state.value = FlowState.Broken;
  };

  const send = async (payload: FlowAnswer): Promise<void> => {
    sending.value = true;
    try {
      await settle(await executeFlow(base, slug, query, payload));
    } catch (error) {
      fail(error);
    } finally {
      sending.value = false;
    }
  };

  return {
    state,
    challenge,
    sending,
    failure: computed(() => broken.value ?? (challenge.value ? formError(challenge.value) : null)),
    async start(): Promise<void> {
      state.value = FlowState.Starting;
      try {
        await settle(await executeFlow(base, slug, query));
      } catch (error) {
        fail(error);
      }
    },
    answer: send,
    take: settle,
  };
};
