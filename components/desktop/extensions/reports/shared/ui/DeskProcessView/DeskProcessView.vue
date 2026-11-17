<template lang="pug">
//- Процесс стола бухгалтера: содержание процесса, документы, операции и
//- проводки. Один виджет на правую панель реестра процессов и на страницу
//- процесса. Операция и проводка открываются в правой панели поверх.
.desk-process
  ProcessDetailCard(
    v-if='type'
    :coopname='coopname'
    :process-hash='processHash'
    :process-type='type'
    :source='DESK_SOURCE'
    @open-operation='openOperation'
    @open-posting='openPosting'
  )
    template(#summary)
      ProcessContent.q-mb-md(
        :coopname='coopname'
        :process-hash='processHash'
        :process-type='type'
        :source='DESK_SOURCE'
      )

  //- Процесс уже открыт — кнопка перехода к нему в панели операции скрыта.
  OperationDetailsDrawer(
    :coopname='coopname'
    :operation='openedOperation'
    :show-process-link='false'
    @close='openedOperation = null'
  )
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { FailAlert } from 'src/shared/api'
import { ProcessDetailCard } from 'src/widgets/Process/ProcessDetailCard'
import { ProcessContent } from 'src/widgets/Process/ProcessContentCard'
import type { ILedger2Operation, ILedger2Posting } from 'src/entities/Ledger2'
import { DESK_SOURCE, useDeskRegistries } from 'app/extensions/reports/shared/lib/registries'
import { OperationDetailsDrawer, type OperationRef } from '../OperationDetailsDrawer'

const props = defineProps<{
  coopname: string
  processHash: string
  /** Тип процесса, если он уже известен (строка реестра); иначе виджет берёт его из сводки. */
  processType?: string | null
}>()

const emit = defineEmits<{
  /** Тип процесса известен — шапка места (панель, страница) называет процесс. */
  resolved: [processType: string]
}>()

const registries = useDeskRegistries()
const type = ref<string | null>(null)

// Прямая ссылка и страница процесса знают только хэш: тип даёт сводка процесса.
async function resolveType(): Promise<void> {
  if (props.processType) {
    type.value = props.processType
    emit('resolved', props.processType)
    return
  }
  const hash = props.processHash
  try {
    const page = await registries.loadProcesses({
      filter: { coopname: props.coopname, processHash: hash },
      pagination: { page: 1, limit: 1, sortOrder: 'DESC' },
    })
    const found = page?.items?.[0]?.processType ?? null
    if (hash !== props.processHash || !found) return
    type.value = found
    emit('resolved', found)
  } catch (e) {
    FailAlert(e)
  }
}

watch(() => [props.processHash, props.processType], () => void resolveType(), { immediate: true })

// Операция процесса в правой панели — без перехода в реестр операций.
const openedOperation = ref<OperationRef | null>(null)

function openOperation(operation: ILedger2Operation): void {
  openedOperation.value = {
    globalSequence: String(operation.globalSequence),
    processHash: operation.processHash,
    operationCode: operation.operationCode,
    memo: operation.memo,
    action: operation.action,
  }
}

/** Проводка открывает свою операцию (номер операции учёта проводки). */
function openPosting(posting: ILedger2Posting): void {
  if (!posting.parentApplyGlobalSequence) return
  openedOperation.value = {
    globalSequence: String(posting.parentApplyGlobalSequence),
    processHash: posting.processHash,
    operationCode: posting.operationCode,
    memo: posting.memo,
  }
}
</script>
