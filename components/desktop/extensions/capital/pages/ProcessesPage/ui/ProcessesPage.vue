<template lang="pug">
.processes-page
  .row.no-wrap(style='height: calc(100vh - 100px)')
    //- Sidebar со списком процессов
    .processes-sidebar.q-pa-md(style='width: 280px; border-right: 1px solid #e0e0e0; overflow-y: auto')
      .row.items-center.q-mb-md
        .text-h6.col {{ $t('capital.processesPage.title') }}
        q-btn(
          v-if='canEdit'
          flat
          round
          dense
          icon='add'
          color='primary'
          @click='showCreateDialog = true'
        )

      q-list(separator)
        q-item(
          v-for='tmpl in templates'
          :key='tmpl.id'
          clickable
          :active='selectedTemplate?.id === tmpl.id'
          active-class='bg-primary text-white'
          @click='selectTemplate(tmpl)'
        )
          q-item-section
            q-item-label {{ tmpl.title }}
            q-item-label(caption :class='selectedTemplate?.id === tmpl.id ? "text-white" : ""')
              | {{ tmpl.project_hash?.substring(0, 8) }} · {{ tmpl.status }}

      .text-center.text-grey-5.q-mt-lg(v-if='templates.length === 0')
        q-icon(name='account_tree' size='48px')
        .q-mt-sm {{ $t('capital.processesPage.emptyText') }}

    //- Основная область — Vue Flow
    .col.q-pa-md
      template(v-if='selectedTemplate')
        .row.items-center.q-mb-md
          .text-h6.col {{ selectedTemplate.title }}
          q-chip(:color='statusColor' text-color='white' dense) {{ selectedTemplate.status }}
          q-space
          template(v-if='canEdit')
            q-btn.q-ml-sm(
              flat
              dense
              icon='save'
              :label='$t("common.action.save")'
              color='primary'
              @click='saveTemplate'
              :disable='!hasChanges'
            )
            q-btn.q-ml-sm(
              v-if='selectedTemplate.status === "draft"'
              flat
              dense
              icon='play_arrow'
              :label='$t("capital.processesPage.activateLabel")'
              color='positive'
              @click='activateTemplate'
            )
            q-btn.q-ml-sm(
              flat
              dense
              icon='delete'
              color='negative'
              @click='deleteTemplate'
            )

        .vue-flow-container(style='height: calc(100vh - 200px); border: 1px solid #e0e0e0; border-radius: 8px')
          VueFlow(
            v-model:nodes='nodes'
            v-model:edges='edges'
            :default-viewport='{ x: 50, y: 50, zoom: 0.8 }'
            @connect='onConnect'
            @nodes-change='onNodesChange'
            fit-view-on-init
          )
            template(#node-default='{ data }')
              .process-node(:class='{ "start-node": data.is_start }')
                .node-title {{ data.label }}
                .node-estimate(v-if='data.estimate') ⏱ {{ formatEstimateStep(data.estimate) }}

            Background
            Controls

          .q-mt-sm(v-if='canEdit')
            q-btn(
              flat
              dense
              icon='add'
              :label='$t("capital.processesPage.addStepLabel")'
              @click='addStep'
            )

      .text-center.text-grey-5(v-else style='padding-top: 200px')
        q-icon(name='account_tree' size='64px')
        .text-h6.q-mt-md {{ $t('capital.processesPage.selectProcessText') }}
        .text-grey-6 {{ $t('capital.processesPage.orCreateNewText') }}

  //- Диалог создания
  q-dialog(v-model='showCreateDialog')
    q-card(style='min-width: 400px')
      q-card-section
        .text-h6 {{ $t('capital.processesPage.newProcessLabel') }}
      q-card-section
        q-input(v-model='newTitle' :label='$t("capital.processesPage.nameLabel")' autofocus)
        q-input.q-mt-sm(v-model='newDescription' :label='$t("capital.processesPage.descriptionLabel")' type='textarea')
        q-input.q-mt-sm(v-model='newProjectHash' :label='$t("capital.processesPage.componentHashLabel")')
      q-card-actions(align='right')
        q-btn(flat :label='$t("common.action.cancel")' @click='showCreateDialog = false')
        q-btn(flat :label='$t("common.action.create")' color='primary' @click='createTemplate')
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConfirm } from 'src/shared/lib/composables'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { useSessionStore } from 'src/entities/Session'
import * as processApi from 'app/extensions/capital/entities/Process/api'
import type { ProcessTemplate, ProcessStepTemplate, ProcessEdge as PEdge } from 'app/extensions/capital/entities/Process/model/types'
import type { Connection } from '@vue-flow/core'
import { t as i18nT } from '../../../i18n';

interface ProcessNodeData {
  label: string
  is_start?: boolean
  estimate?: number
}

interface ProcessNodeShape {
  id: string
  type: string
  position: { x: number; y: number }
  data: ProcessNodeData
}

interface ProcessEdgeShape {
  id: string
  source: string
  target: string
  animated?: boolean
}

const { confirm } = useConfirm()
const session = useSessionStore()
const canEdit = computed(() => session.isChairman || session.isMember)

function formatEstimateStep(hours: number): string {
  if (!hours || Number.isNaN(hours)) return ''
  const rounded = hours % 1 === 0 ? hours : parseFloat(hours.toFixed(2))
  return i18nT('capital.processesPage.hoursValue', { roundedHours: rounded })
}

const templates = ref<ProcessTemplate[]>([])
const selectedTemplate = ref<ProcessTemplate | null>(null)
const nodes = ref<ProcessNodeShape[]>([])
const edges = ref<ProcessEdgeShape[]>([])
const hasChanges = ref(false)

const showCreateDialog = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const newProjectHash = ref('')

const statusColor = computed(() => {
  switch (selectedTemplate.value?.status) {
    case 'active': return 'positive'
    case 'draft': return 'warning'
    case 'archived': return 'grey'
    default: return 'grey'
  }
})

onMounted(async () => {
  await loadTemplates()
})

async function loadTemplates() {
  try {
    templates.value = await processApi.getProcessTemplates()
  } catch (e) {
    console.warn('Ошибка загрузки процессов:', e)
  }
}

function selectTemplate(tmpl: ProcessTemplate) {
  selectedTemplate.value = tmpl
  nodes.value = tmpl.steps.map(s => ({
    id: s.id,
    type: 'default',
    position: s.position,
    data: { label: s.title, is_start: s.is_start, estimate: s.estimate },
  }))
  edges.value = tmpl.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: true,
  }))
  hasChanges.value = false
}

function onConnect(connection: Connection) {
  const id = `e-${connection.source}-${connection.target}`
  edges.value.push({ id, source: connection.source, target: connection.target, animated: true })
  hasChanges.value = true
}

function onNodesChange() {
  hasChanges.value = true
}

function addStep() {
  const id = `step-${Date.now()}`
  const title = prompt(i18nT('capital.processesPage.stepNamePrompt'))
  if (!title) return
  const isStart = nodes.value.length === 0
  nodes.value.push({
    id,
    type: 'default',
    position: { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
    data: { label: title, is_start: isStart, estimate: 0 },
  })
  hasChanges.value = true
}

async function saveTemplate() {
  if (!selectedTemplate.value) return
  const steps: ProcessStepTemplate[] = nodes.value.map(n => ({
    id: n.id,
    title: n.data?.label ?? '',
    description: '',
    estimate: n.data?.estimate ?? 0,
    position: n.position,
    is_start: n.data?.is_start ?? false,
  }))
  const processEdges: PEdge[] = edges.value.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }))
  try {
    const updated = await processApi.updateProcessTemplate({
      id: selectedTemplate.value.id,
      steps,
      edges: processEdges,
    })
    selectedTemplate.value = updated
    hasChanges.value = false
  } catch (e) {
    console.error('Ошибка сохранения:', e)
  }
}

async function activateTemplate() {
  if (!selectedTemplate.value) return
  try {
    const updated = await processApi.updateProcessTemplate({
      id: selectedTemplate.value.id,
      status: 'active',
    })
    selectedTemplate.value = updated
    const idx = templates.value.findIndex(t => t.id === updated.id)
    if (idx >= 0) templates.value[idx] = updated
  } catch (e) {
    console.error('Ошибка активации:', e)
  }
}

async function deleteTemplate() {
  if (!selectedTemplate.value) return
  if (!(await confirm({ title: i18nT('capital.processesPage.deleteConfirm'), message: i18nT('capital.processesPage.deleteConfirmMessage', { title: selectedTemplate.value.title }), confirmLabel: i18nT('common.action.delete'), danger: true }))) return
  try {
    await processApi.deleteProcessTemplate(selectedTemplate.value.id)
    templates.value = templates.value.filter(t => t.id !== selectedTemplate.value?.id)
    selectedTemplate.value = null
    nodes.value = []
    edges.value = []
  } catch (e) {
    console.error('Ошибка удаления:', e)
  }
}

async function createTemplate() {
  if (!newTitle.value || !newProjectHash.value) return
  try {
    const tmpl = await processApi.createProcessTemplate({
      project_hash: newProjectHash.value,
      title: newTitle.value,
      description: newDescription.value,
    })
    templates.value.unshift(tmpl)
    showCreateDialog.value = false
    newTitle.value = ''
    newDescription.value = ''
    selectTemplate(tmpl)
  } catch (e) {
    console.error('Ошибка создания:', e)
  }
}
</script>

<style scoped>
.processes-sidebar {
  background: #fafafa;
}
.process-node {
  padding: 8px 16px;
  border-radius: 6px;
  background: white;
  border: 2px solid #1976d2;
  min-width: 120px;
  text-align: center;
}
.start-node {
  border-color: #4caf50;
  background: #e8f5e9;
}
.node-title {
  font-weight: 500;
  font-size: 13px;
}
.node-estimate {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}
</style>
