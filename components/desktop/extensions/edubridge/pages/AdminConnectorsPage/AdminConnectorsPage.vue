<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-connectors:banner-dismissed")
    | Площадки — носители доступа. Ключи подключения задаются здесь и хранятся зашифрованными; видны они только вам,
    | администраторам недоступны. После смены ключей площадка проверяется заново.
  CardListSkeleton(v-if="loading && !items.length" :count="3")
  .row.q-col-gutter-md(v-else)
    .col-12.col-md-6.col-xl-4(v-for="c in items" :key="c.carrier")
      BaseCard.edu-connector(variant="default" :title="carrierLabel(c.carrier)")
        template(#actions)
          BaseBadge(:variant="stateOf(c).variant") {{ stateOf(c).label }}
        DataRow(label="Подключение" :value="c.enabled ? 'включена' : 'выключена'")
        DataRow(v-if="c.credential_fields.length" label="Ключи" :value="c.configured ? 'заданы' : 'не заданы'")
        DataRow(label="Последняя проверка" :value="c.last_check_at ? formatDateTime(c.last_check_at) : '______'")
        DataRow(v-if="c.last_check_message" label="Результат" :value="c.last_check_message")
        .edu-connector__actions
          BaseButton(v-if="c.credential_fields.length" variant="ghost" size="sm" @click="openCredentials(c)") {{ c.configured ? 'Ключи' : 'Задать ключи' }}
          BaseButton(variant="ghost" size="sm" :loading="busy === c.carrier + ':toggle'" @click="toggle(c)") {{ c.enabled ? 'Выключить' : 'Включить' }}
          BaseButton(variant="secondary" size="sm" :disabled="!c.configured" :loading="busy === c.carrier" @click="check(c)") Проверить

  BaseDialog(v-model="credentialsOpen" :title="editing ? `Ключи: ${carrierLabel(editing.carrier)}` : 'Ключи'" size="md")
    BaseForm(v-if="editing" :loading="savingCredentials" @submit="saveCredentials")
      BaseInput(
        v-for="f in editing.credential_fields"
        :key="f.key"
        v-model="credentialValues[f.key]"
        :label="f.label"
        :type="f.secret ? 'password' : 'text'"
        :hint="f.is_set ? `${f.note ? f.note + '. ' : ''}Задано — оставьте пустым, чтобы не менять` : f.note"
        :required="!f.is_set"
        mono
      )
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="savingCredentials" @click="credentialsOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="savingCredentials") Сохранить и проверить
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseInput, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { CARRIER_LABELS } from '../../entities/Course';
import { HEALTH_LABELS, checkConnector, fetchConnectors, setConnectorCredentials, setConnectorEnabled, type IConnector } from '../../entities/Admin';

/**
 * Площадки: карточка на носитель — состояние в шапке, свойства строками,
 * действия в подвале. Ключи задаются здесь же (только владелец), уходят на
 * бэкенд и обратно не приходят — форма знает лишь, задано ли поле. Настроенная,
 * но ни разу не проверенная площадка проверяется при открытии страницы сама.
 */
const items = ref<IConnector[]>([]);
const loading = ref(false);
const busy = ref<string | null>(null);
const credentialsOpen = ref(false);
const editing = ref<IConnector | null>(null);
const credentialValues = ref<Record<string, string>>({});
const savingCredentials = ref(false);

const carrierLabel = (c: string) => CARRIER_LABELS[c] ?? c;
const formatDateTime = (v: string | Date) => new Date(v).toLocaleString('ru-RU');
function stateOf(c: IConnector): { label: string; variant: 'pos' | 'neg' | 'warn' | 'neutral' } {
  if (c.credential_fields.length && !c.configured) return { label: 'Не настроена', variant: 'warn' };
  if (!c.enabled) return { label: 'Выключена', variant: 'neutral' };
  return HEALTH_LABELS[c.health] ?? { label: c.health, variant: 'neutral' };
}

function replace(c: IConnector): void {
  items.value = items.value.map((x) => (x.carrier === c.carrier ? c : x));
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    items.value = await fetchConnectors();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
  // Ключи есть, а проверки ещё не было — проверяем сразу, чтобы состояние не висело «не проверялась».
  for (const c of items.value) {
    if (c.enabled && c.configured && c.health === Zeus.EduConnectorHealth.UNKNOWN) void check(c);
  }
}
async function check(c: IConnector): Promise<void> {
  busy.value = c.carrier;
  try {
    replace(await checkConnector(c.carrier));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}
async function toggle(c: IConnector): Promise<void> {
  busy.value = `${c.carrier}:toggle`;
  try {
    replace(await setConnectorEnabled(c.carrier, !c.enabled));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = null;
  }
}
function openCredentials(c: IConnector): void {
  editing.value = c;
  credentialValues.value = Object.fromEntries(c.credential_fields.map((f) => [f.key, '']));
  credentialsOpen.value = true;
}
async function saveCredentials(): Promise<void> {
  if (!editing.value) return;
  savingCredentials.value = true;
  try {
    const values = Object.entries(credentialValues.value).map(([key, value]) => ({ key, value }));
    const saved = await setConnectorCredentials(editing.value.carrier, values);
    replace(saved);
    credentialsOpen.value = false;
    SuccessAlert('Ключи сохранены');
    if (saved.configured) await check(saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    savingCredentials.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.edu-connector {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.edu-connector :deep(.base-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.edu-connector__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--p-2);
  margin-top: auto;
  padding-top: var(--p-4);
}
</style>
