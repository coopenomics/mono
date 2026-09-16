import { client } from 'src/shared/api/client'
import { signDocument } from 'src/shared/lib/document'
import { Mutations, Zeus } from '@coopenomics/sdk'
import { computed, ref, type Ref } from 'vue'
import { useMeetStore } from 'src/entities/Meet'
import { useSessionStore } from 'src/entities/Session'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import moment from 'src/shared/lib/utils/dates/moment'
import { useSystemStore } from 'src/entities/System/model'

export type ISignBySecretaryResult = Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.IOutput[typeof Mutations.Meet.SignBySecretaryOnAnnualGeneralMeet.name]
export type ISignByPresiderResult = Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.IOutput[typeof Mutations.Meet.SignByPresiderOnAnnualGeneralMeet.name]

interface ICloseMeetWithDecisionInput {
  coopname: string
  hash: string
  username: string
}

// Базовые функции API для работы с бэкендом
export async function signBySecretaryOnAnnualGeneralMeetWithDecision(data: ICloseMeetWithDecisionInput): Promise<ISignBySecretaryResult> {

  const variables: Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.IInput = {
    data: {
      coopname: data.coopname,
      username: data.username,
      meet_hash: data.hash
    }
  }

  // Генерируем документ решения
  const { [Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.name]: generatedDocument } = await client.Mutation(
    Mutations.Meet.GenerateAnnualGeneralMeetDecisionDocument.mutation,
    {
      variables
    }
  )

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
    throw new Error('Собрание не найдено в store')
  }

  if (!currentMeet.processing.meet.decision1) {
    throw new Error('Документ решения секретаря (decision1) не найден')
  }

  if (!currentMeet.processing.meet.decision1.rawDocument) {
    throw new Error('Сырой документ решения секретаря (rawDocument) не найден')
  }

  if (!currentMeet.processing.meet.decision1.document) {
    throw new Error('Подписанный документ решения секретаря (document) не найден')
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

  const closeMeetBySecretary = async () => {
    if (!meetStore.currentMeet) return
    processingRef.value = true
    try {
      await signBySecretaryOnAnnualGeneralMeetWithDecision({
        coopname: info.coopname,
        hash: meetStore.currentMeet.hash,
        username: sessionStore.username,
      })

      await meetStore.loadMeet({ coopname: info.coopname, hash: meetStore.currentMeet.hash })
      SuccessAlert('Собрание успешно закрыто')
    } catch (error: any) {
      FailAlert(error)
    } finally {
      processingRef.value = false
    }
  }

  const closeMeetByPresider = async () => {
    if (!meetStore.currentMeet) return
    processingRef.value = true
    try {
      await signByPresiderOnAnnualGeneralMeetWithDecision({
        coopname: info.coopname,
        hash: meetStore.currentMeet.hash,
        username: sessionStore.username,
      })

      await meetStore.loadMeet({ coopname: info.coopname, hash: meetStore.currentMeet.hash })
      SuccessAlert('Собрание успешно закрыто')
    } catch (error: any) {
      FailAlert(error)
    } finally {
      processingRef.value = false
    }
  }

  return {
    canCloseBySecretary,
    canCloseByPresider,
    closeMeetBySecretary,
    closeMeetByPresider
  }
}
