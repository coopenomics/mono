import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import {
  fetchExtensionOnboardingState,
  completeExtensionOnboardingStep,
} from '../api'
import type {
  IExtensionOnboardingState,
  IExtensionOnboardingStepState,
  ICompleteExtensionOnboardingStepInput,
} from './types'

export interface IExtensionCooperativeOnboardingController {
  state: Ref<IExtensionOnboardingState | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  steps: ComputedRef<IExtensionOnboardingStepState[]>
  allDone: ComputedRef<boolean>
  expiresAt: ComputedRef<string>
  isExpired: ComputedRef<boolean>
  load(): Promise<void>
  completeStep(input: ICompleteExtensionOnboardingStepInput): Promise<void>
  reset(): void
}

/**
 * Платформенный composable онбординга кооператива на расширение.
 *
 * Подгружает state расширения по `extension_name`, отдаёт реактивный
 * `steps[]` и флаг `allDone`. `completeStep` шлёт mutation и обновляет
 * локальное состояние результатом сервера — отдельный fetch не нужен.
 *
 * Используется в `<CooperativeOnboardingGate extension="...">`. Любое
 * расширение, у которого зарегистрированы шаги в платформенном реестре
 * (см. `ONBOARDING_STEP_REGISTRATION_PORT` в controller), сразу же
 * получает рабочий UI без своих api-обвязок.
 */
export function useExtensionCooperativeOnboarding(
  getExtensionName: () => string
): IExtensionCooperativeOnboardingController {
  const state = ref<IExtensionOnboardingState | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const steps = computed<IExtensionOnboardingStepState[]>(
    () => state.value?.steps ?? []
  )
  const allDone = computed<boolean>(() => state.value?.all_done ?? false)
  const expiresAt = computed<string>(
    () => state.value?.onboarding_expire_at ?? ''
  )
  const isExpired = computed<boolean>(() => {
    if (!expiresAt.value) return false
    return new Date(expiresAt.value).getTime() < Date.now()
  })

  async function load(): Promise<void> {
    const extension_name = getExtensionName()
    if (!extension_name) return
    isLoading.value = true
    error.value = null
    try {
      state.value = await fetchExtensionOnboardingState(extension_name)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function completeStep(
    input: ICompleteExtensionOnboardingStepInput
  ): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      state.value = await completeExtensionOnboardingStep(input)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function reset(): void {
    state.value = null
    error.value = null
  }

  watch(
    () => getExtensionName(),
    (next, prev) => {
      if (next && next !== prev) {
        reset()
        void load()
      }
    },
    { immediate: false }
  )

  return {
    state,
    isLoading,
    error,
    steps,
    allDone,
    expiresAt,
    isExpired,
    load,
    completeStep,
    reset,
  }
}
