<template lang="pug">
div.page-shell
  q-card.hero-card(flat)
    .hero-title Копирование голосов
    .hero-subtitle Автоматическое копирование голосов членов совета

  //- Мои настройки копирования
  q-card.q-mt-md(flat)
    q-card-section
      .row.items-center
        .text-h6.col Я копирую голоса
        q-btn(color="primary" icon="add" label="Добавить" no-caps @click="showCreate = true")

    q-separator

    q-card-section
      q-list(separator v-if="mySettings.length")
        q-item(v-for="s in mySettings" :key="s.id")
          q-item-section(avatar)
            q-avatar(color="blue-2" text-color="blue-9" icon="fa-solid fa-user-check")
          q-item-section
            q-item-label {{ s.source_username }}
            q-item-label(caption) {{ s.decision_types?.length ? s.decision_types.join(', ') : 'Все типы решений' }}
          q-item-section(side)
            .row.q-gutter-xs
              q-chip(:color="s.is_active ? 'green' : 'grey'" text-color="white" dense) {{ s.is_active ? 'Активно' : 'Неактивно' }}
              q-btn(v-if="s.is_active" flat dense icon="pause" color="orange" @click="deactivate(s.id)")
                q-tooltip Приостановить
              q-btn(flat dense icon="delete" color="negative" @click="remove(s.id)")
                q-tooltip Удалить

      .text-center.text-grey-5.q-pa-lg(v-else)
        q-icon(name="fa-solid fa-copy" size="48px")
        .q-mt-sm Нет настроек копирования

  //- Кто копирует меня
  q-card.q-mt-md(flat)
    q-card-section
      .text-h6 Мои голоса копируют

    q-separator

    q-card-section
      q-list(separator v-if="copiesToMe.length")
        q-item(v-for="s in copiesToMe" :key="s.id")
          q-item-section(avatar)
            q-avatar(color="teal-2" text-color="teal-9" icon="fa-solid fa-users")
          q-item-section
            q-item-label {{ s.copier_username }}
            q-item-label(caption) {{ s.is_active ? 'Активно' : 'Приостановлено' }}

      .text-center.text-grey-5.q-pa-md(v-else)
        | Никто не копирует ваши голоса

  //- Диалог создания
  q-dialog(v-model="showCreate")
    q-card(style="min-width: 400px")
      q-card-section
        .text-h6 Копировать голос
      q-card-section
        q-input(v-model="newSource" label="Username члена совета" dense outlined autofocus)
        .text-caption.text-grey.q-mt-sm Голос этого члена совета будет автоматически копироваться при голосовании
      q-card-actions(align="right")
        q-btn(flat label="Отмена" @click="showCreate = false")
        q-btn(flat label="Создать" color="primary" @click="create" :disable="!newSource")
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { client } from 'src/shared/api/client'
import { Notify } from 'quasar'

const mySettings = ref<{ id: string; source_username: string; decision_types: string[]; is_active: boolean }[]>([])
const copiesToMe = ref<{ id: string; copier_username: string; is_active: boolean }[]>([])
const showCreate = ref(false)
const newSource = ref('')

async function loadData() {
  try {
    const { getMyVoteCopySettings } = await client.Query({
      getMyVoteCopySettings: {
        id: true, source_username: true, decision_types: true, is_active: true,
      },
    })
    mySettings.value = getMyVoteCopySettings || []
  } catch { /* empty */ }

  try {
    const { getWhoCopiesToMe } = await client.Query({
      getWhoCopiesToMe: {
        id: true, copier_username: true, is_active: true,
      },
    })
    copiesToMe.value = getWhoCopiesToMe || []
  } catch { /* empty */ }
}

async function create() {
  try {
    await client.Mutation({
      createVoteCopy: [{ data: { source_username: newSource.value } }, { id: true }],
    })
    Notify.create({ type: 'positive', message: 'Копирование настроено' })
    showCreate.value = false
    newSource.value = ''
    await loadData()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Ошибка'
    Notify.create({ type: 'negative', message: msg })
  }
}

async function deactivate(id: string) {
  try {
    await client.Mutation({
      deactivateVoteCopy: [{ id }, { is_active: true }],
    })
    await loadData()
  } catch { /* empty */ }
}

async function remove(id: string) {
  try {
    await client.Mutation({
      deleteVoteCopy: [{ id }, true],
    })
    await loadData()
  } catch { /* empty */ }
}

onMounted(loadData)
</script>
