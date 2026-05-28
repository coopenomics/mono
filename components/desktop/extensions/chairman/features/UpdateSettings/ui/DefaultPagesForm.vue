<template lang="pug">
form.full-width(@submit.prevent='submit')
  .q-gutter-md
    // Рабочий стол для авторизованных пользователей
    .row.q-gutter-md
      .col-md-6.col-sm-12
        q-select(
          v-model='formData.authorized_default_workspace'
          :options='workspaceOptions'
          label='Рабочий стол для авторизованных пользователей'
          placeholder='Выберите рабочий стол'
          dense
          outlined
          color="primary"
          emit-value
          map-options
          option-value='value'
          option-label='label'
          @update:model-value='onWorkspaceChange("authorized", $event)'
          :loading='loading'
        )

      .col-md-6.col-sm-12
        q-select(
          v-model='formData.authorized_default_route'
          :options='getRouteOptions(formData.authorized_default_workspace)'
          label='Страница для авторизованных пользователей'
          placeholder='Выберите страницу'
          dense
          outlined
          color="primary"
          emit-value
          map-options
          option-value='value'
          option-label='label'
          :disable='!formData.authorized_default_workspace'
          @update:model-value='onRouteChange("authorized", $event)'
          :loading='loading'
        )

    // Рабочий стол для неавторизованных пользователей
    .row.q-gutter-md
      .col-md-6.col-sm-12
        q-select(
          v-model='formData.non_authorized_default_workspace'
          :options='workspaceOptions'
          label='Рабочий стол для неавторизованных пользователей'
          placeholder='Выберите рабочий стол'
          dense
          outlined
          color="primary"
          emit-value
          map-options
          option-value='value'
          option-label='label'
          @update:model-value='onWorkspaceChange("non_authorized", $event)'
          :loading='loading'
        )

      .col-md-6.col-sm-12
        q-select(
          v-model='formData.non_authorized_default_route'
          :options='getRouteOptions(formData.non_authorized_default_workspace)'
          label='Страница для неавторизованных пользователей'
          placeholder='Выберите страницу'
          dense
          outlined
          color="primary"
          emit-value
          map-options
          option-value='value'
          option-label='label'
          :disable='!formData.non_authorized_default_workspace'
          @update:model-value='onRouteChange("non_authorized", $event)'
          :loading='loading'
        )
  .q-mt-md
    .row.justify-start.q-gutter-sm
      q-btn(
        flat
        label='Сбросить'
        color='grey'
        @click='resetForm'
        :loading='loading'
      )
      q-btn(
        type='submit'
        label='Сохранить'
        color='primary'
        :loading='loading'
        :disable='!hasChanges'
      )
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useSystemStore } from 'src/entities/System/model'
import { useDesktopStore } from 'src/entities/Desktop/model'
import { useUpdateSettings } from '../model'
import { FailAlert, SuccessAlert } from 'src/shared/api'

interface Props {
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  submit: []
  success: []
  error: [error: Error]
}>()

// Система настроек
const systemStore = useSystemStore()
const desktopStore = useDesktopStore()
const { updateSettings } = useUpdateSettings()

// Данные формы
const formData = ref({
  authorized_default_workspace: '',
  authorized_default_route: '',
  non_authorized_default_workspace: '',
  non_authorized_default_route: ''
})

// Оригинальные данные для сравнения
const originalData = ref({ ...formData.value })

// Опции рабочих столов
const workspaceOptions = computed(() => {
  const workspaces = desktopStore.currentDesktop?.workspaces || []
  return workspaces.map(workspace => ({
    value: workspace.name,
    label: workspace.title || workspace.name
  }))
})

// Проверка наличия изменений
const hasChanges = computed(() => {
  return JSON.stringify(formData.value) !== JSON.stringify(originalData.value)
})

// Получить опции маршрутов для выбранного рабочего стола
const getRouteOptions = (workspaceName: string) => {
  if (!workspaceName) return []

  // Получаем маршруты из workspace меню desktop store
  const workspaceMenu = desktopStore.workspaceMenus.find(menu => menu.workspaceName === workspaceName)

  let routes: Array<{value: string, label: string}> = []

  if (workspaceMenu?.mainRoute?.children) {
    // Фильтруем только маршруты с определенными именами (не динамические с параметрами)
    routes = workspaceMenu.mainRoute.children
      .filter((child: any) => child.name && typeof child.name === 'string' && !child.path?.includes(':'))
      .map((child: any) => ({
        value: child.name,
        label: child.meta?.title || child.name
      }))
  }

  // Добавляем глобальные маршруты (signin, signup) для всех рабочих столов
  const globalRoutes = [
    { value: 'signin', label: 'Вход' },
    { value: 'signup', label: 'Регистрация пайщика' }
  ]

  return [...routes, ...globalRoutes]
}

// Загрузка данных при монтировании
onMounted(() => {
  if (systemStore.info?.settings) {
    const settings = systemStore.info.settings
    formData.value = {
      authorized_default_workspace: settings.authorized_default_workspace || '',
      authorized_default_route: settings.authorized_default_route || '',
      non_authorized_default_workspace: settings.non_authorized_default_workspace || '',
      non_authorized_default_route: settings.non_authorized_default_route || ''
    }
    originalData.value = { ...formData.value }
  }
})

// Обработчики изменений
const onWorkspaceChange = (type: 'authorized' | 'non_authorized', value: string) => {
  if (type === 'authorized') {
    formData.value.authorized_default_workspace = value
    // Сбрасываем маршрут при изменении рабочего стола
    formData.value.authorized_default_route = ''
  } else {
    formData.value.non_authorized_default_workspace = value
    formData.value.non_authorized_default_route = ''
  }
}

const onRouteChange = (type: 'authorized' | 'non_authorized', value: string) => {
  if (type === 'authorized') {
    formData.value.authorized_default_route = value
  } else {
    formData.value.non_authorized_default_route = value
  }
}

// Сброс формы
const resetForm = () => {
  formData.value = { ...originalData.value }
}

// Отправка формы
const submit = async () => {
  if (!hasChanges.value) return

  emit('submit')

  try {
    await updateSettings({
      authorized_default_workspace: formData.value.authorized_default_workspace,
      authorized_default_route: formData.value.authorized_default_route,
      non_authorized_default_workspace: formData.value.non_authorized_default_workspace,
      non_authorized_default_route: formData.value.non_authorized_default_route,
    })

    // Обновляем оригинальные данные
    originalData.value = { ...formData.value }

    SuccessAlert('Настройки сохранены успешно')
    emit('success')

  } catch (error: any) {
    console.error('Ошибка сохранения настроек:', error)
    FailAlert(error)
    emit('error', error)
  }
}

// Следим за изменениями в desktopStore для обновления опций
watch(() => desktopStore.currentDesktop?.workspaces, () => {
  // Опции рабочих столов обновятся автоматически через computed
}, { deep: true })
</script>

<style scoped>
.full-width {
  width: 100%;
}
</style>
