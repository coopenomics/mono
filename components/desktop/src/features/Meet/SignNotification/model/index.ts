import { useMeetStore } from 'src/entities/Meet'
import { SuccessAlert, FailAlert } from 'src/shared/api'
import { ref, computed } from 'vue'
import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'
import { signDocument } from 'src/shared/lib/document'
import { useSessionStore } from 'src/entities/Session'

export type IGenerateNotificationInput = Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument.IInput['data']
export type IGenerateNotificationResult = Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument.IOutput[typeof Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument.name]

export type INotifyOnAnnualGeneralMeetInput = Mutations.Meet.NotifyOnAnnualGeneralMeet.IInput['data']
export type INotifyOnAnnualGeneralMeetResult = Mutations.Meet.NotifyOnAnnualGeneralMeet.IOutput[typeof Mutations.Meet.NotifyOnAnnualGeneralMeet.name]

/**
 * Генерирует документ уведомления о собрании
 * @private Внутренняя функция, не экспортируется
 */
async function generateNotification(data: IGenerateNotificationInput, options?: any): Promise<IGenerateNotificationResult> {
  if (!data.meet_hash) {
    throw new Error('Параметр meet_hash обязателен для генерации документа уведомления')
  }

  const { [Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument.name]: generatedDocument } = await client.Mutation(
    Mutations.Meet.GenerateAnnualGeneralMeetNotificationDocument.mutation,
    {
      variables: {
        data,
        options
      }
    }
  )

  return generatedDocument
}

/**
 * Отправляет уведомление о собрании в блокчейн
 * @private Внутренняя функция, не экспортируется
 */
async function notifyOnAnnualGeneralMeet(data: INotifyOnAnnualGeneralMeetInput): Promise<INotifyOnAnnualGeneralMeetResult> {
  const { [Mutations.Meet.NotifyOnAnnualGeneralMeet.name]: result } = await client.Mutation(
    Mutations.Meet.NotifyOnAnnualGeneralMeet.mutation,
    {
      variables: {
        data
      }
    }
  )

  return result
}

/**
 * Проверяет, отправлял ли пользователь уже уведомление о собрании
 * @param meet Данные о собрании
 * @param username Имя пользователя
 */
export function isNotificationSent(meet: any, username: string): boolean {
  if (!meet || !meet.processing || !meet.processing.meet || !meet.processing.meet.notified_users) {
    return false
  }

  // Проверяем, есть ли имя пользователя в массиве notified_users
  return meet.processing.meet.notified_users.includes(username)
}

/**
 * Композабл функция для генерации и подписания уведомления о собрании
 */
export function useSignNotification() {
  const meetStore = useMeetStore()
  const session = useSessionStore()
  const loading = ref(false)

  // Получаем текущее собрание из store
  const currentMeet = computed(() => meetStore.currentMeet)

  // Проверяем, отправлял ли текущий пользователь уведомление
  const hasUserSentNotification = computed(() => {
    return isNotificationSent(currentMeet.value, session.username)
  })

  /**
   * Генерирует и подписывает документ уведомления о собрании
   */
  const signNotification = async (params: {
    coopname: string,
    meet_hash: string,
    username: string
  }) => {
    try {
      loading.value = true

      // Генерируем документ уведомления
      const generatedDocument = await generateNotification({
        coopname: params.coopname,
        meet_hash: params.meet_hash,
        username: params.username
      })

      // Подписываем документ
      const signedDocument = await signDocument(generatedDocument, params.username)
      console.log('signedDocument', signedDocument)

      // Отправляем уведомление в блокчейн
      await notifyOnAnnualGeneralMeet({
        coopname: params.coopname,
        meet_hash: params.meet_hash,
        username: params.username,
        notification: signedDocument
      })
      console.log('after notify')

      // Перезагружаем информацию о собрании
      await meetStore.loadMeet({
        coopname: params.coopname,
        hash: params.meet_hash
      })

      SuccessAlert('Уведомление успешно подписано и отправлено')
      return true
    } catch (error: any) {
      FailAlert(error || 'Не удалось подписать уведомление')
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    signNotification,
    loading,
    hasUserSentNotification
  }
}
