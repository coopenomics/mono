import { ref } from 'vue'
import type { Mutations } from '@coopenomics/sdk'
import { Cooperative } from 'cooptypes'
import { DigitalDocument } from 'src/shared/lib/document'
import { useSystemStore } from 'src/entities/System/model'
import { useSessionStore } from 'src/entities/Session'
import { api } from '../api'

// Типы строго из SDK
export type IConvertToBillingInput = Mutations.Billing.Convert.IInput['input']
export type IConvertToBillingOutput =
  Mutations.Billing.Convert.IOutput[typeof Mutations.Billing.Convert.name]

// Видимость диалога — синглтон на уровне модуля (кнопка-триггер и сам диалог
// должны делить один ref, как useSelectBranch().isVisible).
const isVisible = ref(false)

export function useConvertToBillingVisibility() {
  return { isVisible }
}

/**
 * Конвертация паевого взноса пайщика в членский на биллинг-кошелёк (Epic 12).
 *
 * Двухшаговый flow (как select-branch): generate (заявление document2 по
 * registry 1095) → sign (WIF пайщика) → мутация billingConvert.
 * `amountRub` — сумма в рублях числом (как её отдаёт AmountInput), к мутации
 * уходит как "<N> RUB".
 */
export function useConvertToBilling() {
  const isLoading = ref(false)
  const isSubmitting = ref(false)
  const step = ref(1)
  const amountRub = ref<number | null>(null)
  const generated = ref<Awaited<ReturnType<DigitalDocument['generate']>>>()

  const system = useSystemStore()
  const session = useSessionStore()
  const digitalDocument = new DigitalDocument()

  const assetAmount = () => `${amountRub.value ?? 0} ${system.info.symbols?.root_govern_symbol ?? 'RUB'}`

  const generate = async () => {
    isLoading.value = true
    try {
      generated.value = await digitalDocument.generate<Cooperative.Registry.BillingConversionStatement.Action>({
        registry_id: Cooperative.Registry.BillingConversionStatement.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        convert_amount: assetAmount(),
      })
      step.value = 2
    } finally {
      isLoading.value = false
    }
  }

  const sign = async (): Promise<IConvertToBillingOutput> => {
    isSubmitting.value = true
    try {
      const document = await digitalDocument.sign<Cooperative.Registry.BillingConversionStatement.Meta>(
        session.username,
      )
      const result = await api.convertToBilling({
        coopname: system.info.coopname,
        username: session.username,
        amount: assetAmount(),
        document,
      })
      isVisible.value = false
      step.value = 1
      amountRub.value = null
      return result
    } finally {
      isSubmitting.value = false
    }
  }

  return { isVisible, isLoading, isSubmitting, step, amountRub, generated, generate, sign }
}

