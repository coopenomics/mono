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
 * Пополнение биллинг-кошелька: паевой взнос пайщика по программе «Цифровой
 * Кошелек» транслируется в членский взнос по соглашению о подключении
 * (Epic 12, действие billing::convert).
 *
 * Заявление (document2 по registry 1095) формируется и подписывается одним
 * действием: его текст целиком определён шаблоном реестра и не зависит ни от
 * чего, кроме суммы, поэтому показывать пайщику предпросмотр перед подписью
 * незачем — подписанный экземпляр остаётся в реестре документов.
 *
 * `amountRub` — сумма в рублях числом (как её отдаёт AmountInput), к мутации
 * уходит как "<N> RUB".
 */
export function useConvertToBilling() {
  const isSubmitting = ref(false)
  const amountRub = ref<number | null>(null)

  const system = useSystemStore()
  const session = useSessionStore()
  const digitalDocument = new DigitalDocument()

  const assetAmount = () => `${amountRub.value ?? 0} ${system.info.symbols?.root_govern_symbol ?? 'RUB'}`

  const convert = async (): Promise<IConvertToBillingOutput> => {
    isSubmitting.value = true
    try {
      await digitalDocument.generate<Cooperative.Registry.BillingConversionStatement.Action>({
        registry_id: Cooperative.Registry.BillingConversionStatement.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        convert_amount: assetAmount(),
      })

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
      amountRub.value = null
      return result
    } finally {
      isSubmitting.value = false
    }
  }

  return { isVisible, isSubmitting, amountRub, convert }
}
