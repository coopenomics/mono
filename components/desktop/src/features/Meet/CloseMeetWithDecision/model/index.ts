import { client } from 'src/shared/api/client'
import { signDocument } from 'src/shared/lib/document'
import { Mutations, Zeus } from '@coopenomics/sdk'
import { computed, ref, type Ref } from 'vue'
import { useMeetStore } from 'src/entities/Meet'
import { useSessionStore } from 'src/entities/Session'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import moment from 'src/shared/lib/utils/dates/moment'
import { useSystemStore } from 'src/entities/System/model'
import { t } from 'src/shared/i18n';
import { previewAggregate, type IDocumentAggregate } from 'src/entities/Document/model';

export type ISignBySecretaryResult = Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.IOutput[typeof Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.name]
export type ISignByPresiderResult = Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.IOutput[typeof Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.name]

interface ICloseMeetWithDecisionInput {
  coopname: string
  hash: string
  username: string
}

export type IGeneratedMeetDecision = Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.IOutput[typeof Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.name]

// Протокол собрания для подписи секретаря: генерируется до подписи, чтобы
// секретарь прочитал текст и мог отказаться (решение владельца 24.11.2026:
// протокол вслепую не подписывается).
export async function generateSecretaryProtocol(data: ICloseMeetWithDecisionInput): Promise<IGeneratedMeetDecision> {
  const variables: Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.IInput = {
    data: {
      coopname: data.coopname,
      username: data.username,
      meet_hash: data.hash
    }
  }

  const { [Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.name]: generatedDocument } = await client.Mutation(
    Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.mutation,
    {
      variables
    }
  )
  return generatedDocument
}

// Подпись секретаря под протоколом, который он прочитал.
export async function signBySecretaryOnAnnualGeneralMeetWithDecision(
  data: ICloseMeetWithDecisionInput,
  generatedDocument: IGeneratedMeetDecision
): Promise<ISignBySecretaryResult> {
  // Подписываем документ первой подписью секретаря (signatureId = 1 по умолчанию)
  const signedDocument = await signDocument(generatedDocument, data.username)

  const variables2: Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.IInput = {
    data: {
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
      secretary_decision: signedDocument
    }
  }
  // Закрываем собрание с подписанным решением секретаря
  const { [Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.name]: result } = await client.Mutation(
    Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.mutation,
    {
      variables: variables2
    }
  )

  return result
}

export async function signByPresiderOnAnnualGeneralMeetWithDecision(data: ICloseMeetWithDecisionInput): Promise<ISignByPresiderResult> {
  const meetStore = useMeetStore()

  // Получаем текущее собрание из store
  const currentMeet = meetStore.currentMeet
  if (!currentMeet?.processing?.meet) {
    throw new Error(t('meet.error.notFoundInStore'))
  }

  if (!currentMeet.processing.meet.decision1) {
    throw new Error(t('meet.error.decision1NotFound'))
  }

  if (!currentMeet.processing.meet.decision1.rawDocument) {
    throw new Error(t('meet.error.decision1RawDocumentNotFound'))
  }

  if (!currentMeet.processing.meet.decision1.document) {
    throw new Error(t('meet.error.decision1DocumentNotFound'))
  }

  // Используем существующий rawDocument из decision1 (созданный секретарем)
  // и объединяем подпись секретаря с новой подписью председателя (signatureId = 2)
  // В результате получается единый документ с обеими подписями
  const signedDocument = await signDocument(
    currentMeet.processing.meet.decision1.rawDocument,
    data.username,
    2,
    [currentMeet.processing.meet.decision1.document]
  )

  const variables2: Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.IInput = {
    data: {
      coopname: data.coopname,
      hash: data.hash,
      username: data.username,
      presider_decision: signedDocument
    }
  }

  // Закрываем собрание с подписанным решением председателя
  const { [Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.name]: result } = await client.Mutation(
    Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.mutation,
    {
      variables: variables2
    }
  )

  return result
}

// Композабл для использования в компонентах
export const useCloseMeet = (
  isProcessing?: Ref<boolean>
) => {
  const { info } = useSystemStore()

  const localIsProcessing = ref(false)
  const processingRef = isProcessing || localIsProcessing

  const meetStore = useMeetStore()
  const sessionStore = useSessionStore()

  const canCloseBySecretary = computed(() => {
    const meet = meetStore.currentMeet
    if (!meet?.processing?.meet) return false

    const now = moment()
    const closeAt = moment(meet.processing.meet.close_at as string)

    const isAfterCloseDate = now.isAfter(closeAt)
    const isQuorumPassed = meet.processing.meet.quorum_passed === true
    const isAuthorized = meet.processing.extendedStatus === Zeus.ExtendedMeetStatus.VOTING_COMPLETED
    const isSecretary = meet.processing.meet.secretary === sessionStore.username

    return isAfterCloseDate && isQuorumPassed && isAuthorized && isSecretary
  })

  const canCloseByPresider = computed(() => {
    const meet = meetStore.currentMeet
    if (!meet?.processing?.meet) return false
    const isPresider = meet.processing.meet.presider === sessionStore.username
    return meet.processing.extendedStatus === Zeus.ExtendedMeetStatus.PRECLOSED && isPresider
  })

  // Протокол на прочтение перед подписью: секретарю — только что собранный,
  // председателю — тот же документ с подписью секретаря.
  const protocolPreview = ref<{ role: 'secretary' | 'presider'; aggregate: IDocumentAggregate; generated?: IGeneratedMeetDecision } | null>(null)
  const protocolPreviewOpen = computed({
    get: () => protocolPreview.value !== null,
    set: (open: boolean) => {
      if (!open) protocolPreview.value = null
    }
  })

  const closeInput = (): ICloseMeetWithDecisionInput | null =>
    meetStore.currentMeet
      ? { coopname: info.coopname, hash: meetStore.currentMeet.hash, username: sessionStore.username }
      : null

  const openSecretaryProtocol = async () => {
    const input = closeInput()
    if (!input) return
    processingRef.value = true
    try {
      const generated = await generateSecretaryProtocol(input)
      protocolPreview.value = { role: 'secretary', aggregate: previewAggregate(generated), generated }
    } catch (error: any) {
      FailAlert(error)
    } finally {
      processingRef.value = false
    }
  }

  const openPresiderProtocol = () => {
    const decision1 = meetStore.currentMeet?.processing?.meet?.decision1
    if (!decision1) {
      FailAlert(t('meet.error.decision1NotFound'))
      return
    }
    protocolPreview.value = { role: 'presider', aggregate: decision1 as IDocumentAggregate }
  }

  const confirmProtocol = async () => {
    const preview = protocolPreview.value
    const input = closeInput()
    if (!preview || !input) return
    protocolPreview.value = null
    processingRef.value = true
    try {
      if (preview.role === 'secretary' && preview.generated)
        await signBySecretaryOnAnnualGeneralMeetWithDecision(input, preview.generated)
      else
        await signByPresiderOnAnnualGeneralMeetWithDecision(input)

      await meetStore.loadMeet({ coopname: input.coopname, hash: input.hash })
      SuccessAlert(t('meet.closeMeetWithDecision.success'))
    } catch (error: any) {
      FailAlert(error)
    } finally {
      processingRef.value = false
    }
  }

  return {
    canCloseBySecretary,
    canCloseByPresider,
    protocolPreview,
    protocolPreviewOpen,
    openSecretaryProtocol,
    openPresiderProtocol,
    confirmProtocol
  }
}
