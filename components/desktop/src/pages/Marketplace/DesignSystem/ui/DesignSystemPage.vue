<template>
  <q-page class="mp-design-system">
    <div class="row">
      <!-- Левая колонка — навигация -->
      <aside class="col-12 col-md-3 mp-ds-aside q-pa-md">
        <div class="text-h6 q-mb-sm">Дизайн-система Стола Заказов</div>
        <div class="text-caption text-grey-7 q-mb-md">
          Эпик 10 · MVP · 13 custom-компонентов + токены
        </div>

        <q-list dense bordered separator class="rounded-borders">
          <q-item
            v-for="s in sections"
            :key="s.key"
            clickable
            :active="state.section.value === s.key"
            active-class="bg-primary text-white"
            @click="state.section.value = s.key"
          >
            <q-item-section>
              <q-item-label>{{ s.title }}</q-item-label>
              <q-item-label caption>{{ s.story }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge :color="statusColor[s.status]">
                {{ statusLabel[s.status] }}
              </q-badge>
            </q-item-section>
          </q-item>
        </q-list>
      </aside>

      <!-- Правая колонка — секция компонента -->
      <main class="col-12 col-md-9 q-pa-md">
        <!-- Глобальные переключатели -->
        <div class="row q-gutter-md q-mb-lg items-center mp-ds-controls">
          <q-select
            v-model="state.role.value"
            :options="roles"
            option-value="value"
            option-label="label"
            emit-value
            map-options
            dense
            outlined
            label="Стол / роль"
            style="min-width: 220px"
          >
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.hint }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-btn-toggle
            v-model="state.theme.value"
            :options="[
              { label: 'Light', value: 'light' },
              { label: 'Dark',  value: 'dark' },
            ]"
            unelevated
            toggle-color="primary"
            no-caps
            dense
          />

          <q-btn-toggle
            v-model="state.breakpoint.value"
            :options="breakpoints"
            unelevated
            toggle-color="primary"
            no-caps
            dense
          />

          <q-space />

          <q-chip color="grey-3" text-color="grey-8" icon="fa-solid fa-code">
            {{ state.section.value }}
          </q-chip>
        </div>

        <!-- Контейнер превью с роль-классом и breakpoint-симуляцией -->
        <div
          :class="['mp-ds-preview', state.roleClass.value, themeClass]"
          :style="`max-width: ${state.previewMaxWidth.value}`"
        >
          <component :is="currentSectionComponent" :section="currentSection" />
        </div>
      </main>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { SECTIONS, STATUS_LABEL, STATUS_COLOR } from '../lib/sections'
import { useDesignSystemState, MARKETPLACE_ROLES, BREAKPOINTS } from '../composables/useDesignSystemState'
import TokensSection from './sections/TokensSection.vue'
import PlaceholderSection from './sections/PlaceholderSection.vue'
import CatalogOfferCardSection from './sections/CatalogOfferCardSection.vue'
import OrderCardSection from './sections/OrderCardSection.vue'

const $q = useQuasar()
const state = useDesignSystemState()
const sections = SECTIONS
const roles = MARKETPLACE_ROLES
const breakpoints = BREAKPOINTS
const statusLabel = STATUS_LABEL
const statusColor = STATUS_COLOR

// Реализованные секции: пока только tokens. Остальные — PlaceholderSection.
const SECTION_COMPONENTS: Record<string, unknown> = {
  tokens: TokensSection,
  'catalog-offer-card': CatalogOfferCardSection,
  'order-card': OrderCardSection,
}

const currentSection = computed(() =>
  sections.find((s) => s.key === state.section.value) ?? sections[0]
)

const currentSectionComponent = computed(
  () => SECTION_COMPONENTS[state.section.value] ?? PlaceholderSection
)

const themeClass = computed(() => (state.theme.value === 'dark' ? 'mp-theme-dark' : 'mp-theme-light'))

// Управляем глобальной темой Quasar по переключателю витрины (только пока открыта страница).
let previousDark = false
onMounted(() => {
  previousDark = $q.dark.isActive
  $q.dark.set(state.theme.value === 'dark')
})
watch(() => state.theme.value, (v) => { $q.dark.set(v === 'dark') })
onUnmounted(() => { $q.dark.set(previousDark) })
</script>

<style scoped lang="scss">
.mp-design-system {
  min-height: 100vh;
}

.mp-ds-aside {
  border-right: 1px solid rgba(0, 0, 0, .08);
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: 100vh;
  overflow: auto;
}

.mp-ds-controls {
  border-bottom: 1px solid rgba(0, 0, 0, .06);
  padding-bottom: var(--mp-space-md);
}

.mp-ds-preview {
  margin: 0 auto;
  transition: max-width .25s ease;

  &.mp-theme-dark {
    background: #1f1c1c;
    color: #f0f0f0;
    padding: var(--mp-space-md);
    border-radius: 8px;
  }
}
</style>
