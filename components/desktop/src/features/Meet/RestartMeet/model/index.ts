import { client } from 'src/shared/api/client';
import { Mutations } from '@coopenomics/sdk';
import { DigitalDocument } from 'src/shared/lib/document'
import { useSessionStore } from 'src/entities/Session';
import type { Cooperative } from 'cooptypes';
import { computed, ref, type Ref } from 'vue'
import { useMeetStore } from 'src/entities/Meet'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import moment from 'src/shared/lib/utils/dates/moment'
import { useSystemStore } from 'src/entities/System/model';
import { IGenerateAgendaInput, IGenerateAgendaResult } from 'src/features/Meet/CreateMeet/model'
import { type Router } from 'vue-router';
import { t } from 'src/shared/i18n';

export type IRestartMeetInput = Mutations.Meet.RestartAnnualGeneralMeet.IInput['data'];
export type IRestartMeetResult = Mutations.Meet.RestartAnnualGeneralMeet.IOutput[typeof Mutations.Meet.RestartAnnualGeneralMeet.name];

export interface IRestartMeetWithProposalInput {
  coopname: string
  hash: string
  username: string
  new_open_at: string
  new_close_at: string
  /** Текст для meet_pre нового hash; пустая строка — очистить */
  details?: string
  agenda_points: {
    title: string
    context: string
    decision: string
  }[]
  type: string
}

/**
 * Генерирует документ повестки собрания
 * @private Внутренняя функция, не экспортируется
 */
async function generateAgenda(data: IGenerateAgendaInput, options?: any): Promise<IGenerateAgendaResult> {
  const { [Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.name]: generatedDocument } = await client.Mutation(
    Mutations.Meet.GenerateAnnualGeneralMeetAgendaDocument.mutation,
    {
      variables: {
        data,
        options
      }
    }
  );

  return generatedDocument;
}

// Базовые функции для работы с API
export async function restartMeet(data: IRestartMeetInput): Promise<IRestartMeetResult> {
  const { [Mutations.Meet.RestartAnnualGeneralMeet.name]: result } = await client.Mutation(
    Mutations.Meet.RestartAnnualGeneralMeet.mutation,
    {
      variables: {
        data
      }
    }
  );

  return result;
}

export async function restartMeetWithProposal(data: IRestartMeetWithProposalInput): Promise<IRestartMeetResult> {
  const { username } = useSessionStore()

  // Преобразуем формат даты для документа
  const openAtFormatted = moment(data.new_open_at).format('DD.MM.YYYY HH:mm')
  const closeAtFormatted = moment(data.new_close_at).format('DD.MM.YYYY HH:mm')

  // Формируем вопросы повестки в требуемом формате
  const questions = data.agenda_points.map((point, index) => ({
    number: String(index + 1),
    title: point.title,
    decision: point.decision,
    context: point.context || ''
  }))

  // Генерируем документ повестки с правильными параметрами согласно DTO
  const generatedDocument = await generateAgenda({
    coopname: data.coopname,
    username: data.username,
    meet: {
      type: data.type,
      open_at_datetime: openAtFormatted,
      close_at_datetime: closeAtFormatted
    },
    questions: questions,
    is_repeated: true
  })

  // Подписываем документ
  const rawDocument = new DigitalDocument(generatedDocument)
  const signedDocument = await rawDocument.sign<Cooperative.Registry.AnnualGeneralMeetingAgenda.Meta>(username)

  // Перезапускаем собрание
  const result = await restartMeet({
    coopname: data.coopname,
    hash: data.hash,
    new_open_at: data.new_open_at,
    new_close_at: data.new_close_at,
    newproposal: signedDocument,
    details: data.details,
  })

  console.log('on result', result)

  return result
}


// Композабл для использования в компонентах
export const useRestartMeet = (
  router: Router,
  isProcessing?: Ref<boolean>
) => {
  const localIsProcessing = ref(false)
  const { info } = useSystemStore()

  const processingRef = isProcessing || localIsProcessing

  const meetStore = useMeetStore()
  const sessionStore = useSessionStore()

  const canRestartMeet = computed(() => {
    const meet = meetStore.currentMeet
    if (!meet?.processing?.meet) return false

    const now = moment()
    const closeAt = moment(meet.processing.meet.close_at as string)

    const isAfterCloseDate = now.isAfter(closeAt)
    const isQuorumNotPassed = meet.processing.meet.quorum_passed !== true
    const isAuthorized = meet.processing.meet.status === 'authorized'

    // Дополнительная проверка: только председатель совета или член совета может перезапустить собрание
    const isBoardMember = sessionStore.isChairman || sessionStore.isMember

    return isAfterCloseDate && isQuorumNotPassed && isAuthorized && isBoardMember
  })

  const handleRestartMeet = async (data: {
    new_open_at: string;
    new_close_at: string;
    details: string;
    agenda_points: {
      title: string;
      context: string;
      decision: string;
    }[];
  }) => {
    if (!meetStore.currentMeet) return false
    processingRef.value = true
    try {
      // Выводим полную структуру для отладки
      console.log('Полные данные о собрании:', meetStore.currentMeet)

      // Получаем тип собрания из текущего объекта meet
      // По умолчанию используем 'regular' если тип не найден
      const originalMeetType = (meetStore.currentMeet.processing?.meet.proposal?.document.meta as any).meet.type

      // Выводим для отладки
      console.log('Тип собрания для перезапуска:', originalMeetType)

      const result = await restartMeetWithProposal({
        coopname: info.coopname,
        hash: meetStore.currentMeet.hash,
        username: sessionStore.username,
        new_open_at: data.new_open_at,
        new_close_at: data.new_close_at,
        details: data.details,
        agenda_points: data.agenda_points,
        type: originalMeetType // Передаем оригинальный тип собрания
      })

      await meetStore.loadMeet({ coopname: info.coopname, hash: result.processing?.hash as string})
      console.log('router on push', router)
      router.push({params: {hash: result.processing?.hash as string}})

      SuccessAlert(t('meet.restartMeetModel.success'))
      return true
    } catch (error: any) {
      FailAlert(error)
      return false
    } finally {
      processingRef.value = false
    }
  }

  return {
    canRestartMeet,
    handleRestartMeet
  }
}
