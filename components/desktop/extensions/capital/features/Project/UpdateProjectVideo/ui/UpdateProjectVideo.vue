<template lang="pug">
q-input(
  v-if="project && project.permissions?.can_edit_project"
  v-model="videoIframe"
  label="Встроить видео (iframe)"
  dense
  standout="bg-teal text-white"
  @change="updateVideo"
  placeholder='<iframe ...>'
).q-mb-sm
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { IProject } from 'app/extensions/capital/entities/Project/model'
import { buildEditProjectInput, useEditProject } from '../../EditProject'

interface Props {
  project: IProject | null | undefined
}

const props = defineProps<Props>()

const { saveImmediately } = useEditProject()
const videoIframe = ref('')

const getMeta = (project: any) => {
  try {
    return typeof project?.meta === 'string' ? JSON.parse(project.meta) : project?.meta || {}
  } catch {
    return {}
  }
}

watch(() => props.project, (newProject) => {
  if (newProject) {
    const meta = getMeta(newProject)
    const rawVideo = meta.video || ''
    
    // Декодируем только для отображения в инпуте, чтобы пользователь видел чистый iframe
    if (rawVideo.includes('&lt;')) {
      const txt = document.createElement('textarea')
      txt.innerHTML = rawVideo
      videoIframe.value = txt.value
    } else {
      videoIframe.value = rawVideo
    }
  }
}, { immediate: true })

const updateVideo = async () => {
  if (!props.project) return

  const meta = getMeta(props.project)
  meta.video = videoIframe.value

  await saveImmediately(buildEditProjectInput(props.project, { meta: JSON.stringify(meta) }))
}
</script>
