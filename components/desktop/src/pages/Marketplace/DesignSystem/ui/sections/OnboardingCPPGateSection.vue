<template>
  <div>
    <div class="text-h5 q-mb-md">OnboardingCPPGate · Story 10.2.11 · UX-DR17</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      L3-gate подключения к Столу Заказов: одна оферта присоединения к ЦПП per-роль
      (заказчик / поставщик). Согласие на обработку данных и базовые правила платформы —
      приняты на L2 при регистрации пайщика и здесь не дублируются.
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Стол заказчика</div>
        <OnboardingCPPGate
          title="Подключение к Столу Заказов"
          subtitle="Стол заказчика (orderer)"
          lead-text="Подтвердите согласие с условиями участия в ЦПП «Стол Заказов»."
          :documents="ordererDocs"
          @accept="onAccept('orderer', $event)"
          @decline="onDecline('orderer')"
        />
      </div>
      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Стол поставщика</div>
        <OnboardingCPPGate
          title="Подключение поставщика"
          subtitle="Стол поставщика (offerer)"
          lead-text="Подтвердите согласие с условиями участия в ЦПП «Стол Заказов» в роли поставщика."
          :documents="offererDocs"
          confirm-label="Принять и стать поставщиком"
          @accept="onAccept('offerer', $event)"
          @decline="onDecline('offerer')"
        />
      </div>
    </div>

    <q-banner v-if="event" class="mp-event-banner q-mt-lg" rounded>
      Событие: <strong>{{ event }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { OnboardingCPPGate, type CPPDocument } from 'src/widgets/Marketplace/OnboardingCPPGate'

const event = ref('')

// Per-роль — РОВНО одна оферта (фидбэк 2026-05-15):
// «ПВЗ-логистика», «ценовая политика», «согласие на режим самозанятого/ИП»,
// «подписка на рассылку» — в архитектуре нет и сейчас не нужны.
const ordererDocs: CPPDocument[] = [
  {
    id: 'cpp-orderer',
    title: 'Оферта присоединения к ЦПП «Стол Заказов»',
    description: 'Целевая потребительская программа кооператива, роль заказчика',
    required: true,
  },
]

const offererDocs: CPPDocument[] = [
  {
    id: 'cpp-offerer',
    title: 'Оферта присоединения к ЦПП «Стол Заказов» (поставщик)',
    description: 'Целевая потребительская программа кооператива, роль поставщика',
    required: true,
  },
]

function onAccept(role: string, docs: string[]) { event.value = `accept ${role}: ${docs.join(', ')}` }
function onDecline(role: string) { event.value = `decline ${role}` }
</script>
