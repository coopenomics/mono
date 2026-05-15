<template>
  <div>
    <div class="text-h5 q-mb-md">OnboardingCPPGate · Story 10.2.11 · UX-DR17</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Пакет документов на онбординге пайщика per-стол. Реализует L3-gate
      трёхуровневого онбординга расширений (L1 кооператив → L2 пайщик при регистрации
      → L3 gate на столе). Используется в Эпике 1 (Установка и онбординг).
    </div>

    <div class="row q-col-gutter-lg">
      <div class="col-12 col-md-6">
        <div class="text-subtitle1 q-mb-sm">Стол заказчика</div>
        <OnboardingCPPGate
          title="Подключение к Столу Заказов"
          subtitle="Стол заказчика (orderer)"
          lead-text="Ознакомьтесь с правилами Стола Заказов и подтвердите согласие на участие."
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
          lead-text="Дополнительно к пакету заказчика поставщик соглашается с регламентом размещения предложений."
          :documents="offererDocs"
          confirm-label="Принять и стать поставщиком"
          @accept="onAccept('offerer', $event)"
          @decline="onDecline('offerer')"
        />
      </div>
    </div>

    <q-banner v-if="event" class="bg-grey-2 q-mt-lg" rounded>
      Событие: <strong>{{ event }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { OnboardingCPPGate, type CPPDocument } from 'src/widgets/Marketplace/OnboardingCPPGate'

const event = ref('')

const ordererDocs: CPPDocument[] = [
  { id: 'rules-mp',     title: 'Регламент Стола Заказов', description: 'Правила работы стола, утверждённые советом', required: true },
  { id: 'agree-data',   title: 'Согласие на обработку данных', required: true },
  { id: 'agree-pvz',    title: 'Согласие на ПВЗ-логистику', description: 'Доставка через ПВЗ кооператива', required: true },
  { id: 'newsletter',   title: 'Подписка на рассылку новинок', description: 'Не обязательно — можно отказаться позже' },
]

const offererDocs: CPPDocument[] = [
  { id: 'rules-mp',      title: 'Регламент Стола Заказов', required: true, locked: true, description: 'Принят при регистрации пайщика' },
  { id: 'rules-offer',   title: 'Регламент размещения предложений', required: true },
  { id: 'agree-vat',     title: 'Согласие на режим самозанятого/ИП', required: true },
  { id: 'price-policy',  title: 'Ценовая политика стола', description: 'Маржа и комиссия кооператива' },
]

function onAccept(role: string, docs: string[]) { event.value = `accept ${role}: ${docs.join(', ')}` }
function onDecline(role: string) { event.value = `decline ${role}` }
</script>
