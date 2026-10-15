<template lang="pug">
div(v-if="project && project.permissions?.can_edit_project").q-mb-sm.full-width
  q-input(
    v-model="urlDraft"
    dense
    standout="bg-teal text-white"
    type="url"
    :label="$t('capital.setDevelopmentRepositoryUrl.label')"
    :loading="saving"

    @keydown.enter.prevent="persist"
  )
    template(#append)
      q-btn(
        v-if="dirty"
        flat
        round
        dense
        color="primary"
        icon="save"
        :loading="saving"
        @click="persist"
      )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { IProject } from 'app/extensions/capital/entities/Project/model'
import { useProjectStore } from 'app/extensions/capital/entities/Project/model'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { setDevelopmentRepositoryUrl } from '../api'
import { t as i18nT } from '../../../../i18n';

interface Props {
  project: IProject | null | undefined
}

const props = defineProps<Props>()

const projectStore = useProjectStore()
const urlDraft = ref('')
const saving = ref(false)

watch(
  () => props.project,
  (p) => {
    urlDraft.value = p?.development_repository_url ?? ''
  },
  { immediate: true },
)

const normalizedDraft = computed(() => {
  const t = urlDraft.value.trim()
  return t.length > 0 ? t : null
})

const normalizedStored = computed(() => {
  const u = props.project?.development_repository_url?.trim()
  return u && u.length > 0 ? u : null
})

const dirty = computed(() => normalizedDraft.value !== normalizedStored.value)

async function persist() {
  if (!props.project?.project_hash || saving.value || !dirty.value) return
  saving.value = true
  try {
    const updated = await setDevelopmentRepositoryUrl({
      project_hash: props.project.project_hash,
      development_repository_url: normalizedDraft.value,
    })
    projectStore.addProjectToList(updated)
    SuccessAlert(i18nT('capital.setDevelopmentRepositoryUrl.success'))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : i18nT('capital.setDevelopmentRepositoryUrl.error')
    FailAlert(message)
  } finally {
    saving.value = false
  }
}
</script>
