import { ref } from 'vue'
import { api, type GeneratedDocument } from '../api'
import type { IDocumentPreset } from './types'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { signDocument } from 'src/shared/lib/document'

export * from './presets'

export const useAgendaPresets = () => {
  const loading = ref(false)
  const submitting = ref(false)
  const generatedDocument = ref<GeneratedDocument | null>(null)
  const currentPreset = ref<IDocumentPreset | null>(null)
  const showDialog = ref(false)

  const generateDocument = async (preset: IDocumentPreset) => {
    try {
      loading.value = true
      currentPreset.value = preset

      const document = await api.generateDocument({
        data: preset.getData(),
        options: {
          skip_save: true,
        },
      })

      generatedDocument.value = document
      showDialog.value = true
    } catch (error) {
      FailAlert(error)
    } finally {
      loading.value = false
    }
  }

  const submitProposal = async (coopname: string, username: string) => {
    if (!generatedDocument.value || !currentPreset.value) {
      throw new Error('Нет сгенерированного документа')
    }

    try {
      submitting.value = true

      // 1. Создаем проект свободного решения
      const project = await api.createProjectOfFreeDecision({
        title: currentPreset.value.title,
        question: currentPreset.value.question,
        decision: `${currentPreset.value.decisionPrefix}\n\n${generatedDocument.value.html}`,
      })

      if (!project?.id) {
        throw new Error('Не удалось создать проект решения')
      }

      // 2. Генерируем документ проекта решения
      const projectDocument = await api.generateProjectOfFreeDecisionDocument({
        project_id: project.id,
        coopname,
        username,
      })

      // 3. Подписываем документ
      const signedDocument = await signDocument(projectDocument, username)

      // 4. Публикуем подписанный документ
      await api.publishProjectOfFreeDecision({
        coopname,
        username,
        document: signedDocument,
        meta: '',
      })

      SuccessAlert('Предложение повестки успешно создано')
      closeDialog()
    } catch (error) {
      FailAlert(error)
      throw error
    } finally {
      submitting.value = false
    }
  }

  const closeDialog = () => {
    showDialog.value = false
    generatedDocument.value = null
    currentPreset.value = null
  }

  return {
    loading,
    submitting,
    generatedDocument,
    currentPreset,
    showDialog,
    generateDocument,
    submitProposal,
    closeDialog,
  }
}
