<template lang="pug">
q-page.secretary-rooms-page(padding)
  header.sr-head
    div.sr-head__text
      h1.sr-head__title Комнаты секретаря
      p.sr-head__subtitle
        | Создавайте комнаты для звонков с секретарём — он подключается сразу и ведёт транскрипцию.
        | Системные и проектные комнаты показаны для справки и не удаляются.
    .sr-head__actions
      q-btn(
        unelevated
        no-caps
        color="primary"
        icon="fa-solid fa-plus"
        label="Создать комнату"
        @click="openCreateDialog"
      )
      q-btn.sr-head__refresh(
        flat
        round
        dense
        icon="fa-solid fa-rotate-right"
        @click="handleRefresh"
        :loading="store.isLoading"
        aria-label="Обновить список"
      )
        q-tooltip Обновить

  q-banner.sr-error(v-if="store.error" dense rounded class="bg-red-1 text-red-9 q-mb-md")
    | {{ store.error }}

  q-table(
    flat
    bordered
    :rows="store.rooms"
    :columns="columns"
    row-key="id"
    :loading="store.isLoading"
    :rows-per-page-options="[0]"
    hide-pagination
    no-data-label="Комнат пока нет"
  )
    template(#body-cell-displayLabel="props")
      q-td(:props="props")
        .sr-name {{ props.row.displayLabel }}
    template(#body-cell-kind="props")
      q-td(:props="props")
        q-badge(:color="kindColor(props.row.kind)" :label="kindLabel(props.row.kind)" outline)
    template(#body-cell-secretary="props")
      q-td(:props="props")
        q-icon(
          :name="props.row.secretaryInRoom ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-minus'"
          :color="props.row.secretaryInRoom ? 'positive' : 'grey-5'"
          size="18px"
        )
          q-tooltip {{ props.row.secretaryInRoom ? 'Секретарь в комнате' : 'Секретаря нет' }}
        q-icon.q-ml-sm(
          v-if="props.row.encrypted"
          name="fa-solid fa-lock"
          color="orange-8"
          size="16px"
        )
          q-tooltip Зашифрованная комната — транскрипция недоступна
    template(#body-cell-actions="props")
      q-td(:props="props" align="right")
        q-btn(
          v-if="props.row.editable"
          flat
          dense
          no-caps
          color="negative"
          icon="fa-solid fa-trash"
          label="Удалить"
          @click="confirmRemove(props.row)"
        )
        span.text-grey-5(v-else) —

  //- Диалог создания комнаты
  q-dialog(v-model="createDialog")
    q-card.sr-dialog
      q-card-section
        .text-h6 Новая комната секретаря
      q-card-section.q-pt-none
        q-input(
          v-model="form.displayName"
          label="Название комнаты"
          autofocus
          :rules="[(v) => !!v && v.trim().length > 0 || 'Введите название']"
          maxlength="240"
        )
        .sr-type.q-mt-md
          .text-subtitle2.q-mb-xs Тип комнаты
          q-option-group(
            v-model="form.isPublic"
            :options="typeOptions"
            color="primary"
            type="radio"
          )
          .text-caption.text-grey-7.q-mt-xs
            | {{ form.isPublic ? 'Публичная: войти может любой пайщик.' : 'Приватная: участников приглашаете вы (в клиенте мессенджера).' }}
      q-card-actions(align="right")
        q-btn(flat no-caps label="Отмена" v-close-popup :disable="store.isMutating")
        q-btn(
          unelevated
          no-caps
          color="primary"
          label="Создать"
          :loading="store.isMutating"
          @click="submitCreate"
        )
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useSecretaryRoomStore } from '../../../entities/SecretaryRoom';
import type { ISecretaryRoom } from '../../../entities/SecretaryRoom';

const $q = useQuasar();
const store = useSecretaryRoomStore();

const createDialog = ref(false);
const form = ref<{ displayName: string; isPublic: boolean }>({
  displayName: '',
  isPublic: false,
});

const typeOptions = [
  { label: 'Приватная (по приглашению)', value: false },
  { label: 'Публичная (открытый вход)', value: true },
];

const columns = [
  {
    name: 'displayLabel',
    label: 'Комната',
    field: 'displayLabel',
    align: 'left' as const,
    style: 'min-width: 320px;',
  },
  { name: 'kind', label: 'Тип', field: 'kind', align: 'left' as const },
  { name: 'secretary', label: 'Секретарь', field: 'secretaryInRoom', align: 'left' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
];

function kindLabel(kind: ISecretaryRoom['kind']): string {
  switch (kind) {
    case 'MEMBERS':
      return 'Пайщики';
    case 'COUNCIL':
      return 'Совет';
    case 'CAPITAL_PROJECT':
      return 'Проект';
    case 'SECRETARY':
      return 'Секретарь';
    default:
      return String(kind);
  }
}

function kindColor(kind: ISecretaryRoom['kind']): string {
  switch (kind) {
    case 'SECRETARY':
      return 'primary';
    case 'CAPITAL_PROJECT':
      return 'teal';
    default:
      return 'grey-7';
  }
}

function openCreateDialog(): void {
  form.value = { displayName: '', isPublic: false };
  store.clearError();
  createDialog.value = true;
}

async function submitCreate(): Promise<void> {
  const name = form.value.displayName.trim();
  if (name.length === 0) {
    return;
  }
  try {
    await store.createRoom({ displayName: name, isPublic: form.value.isPublic });
    createDialog.value = false;
    $q.notify({ type: 'positive', message: 'Комната создана, секретарь подключён' });
  } catch (err) {
    $q.notify({ type: 'negative', message: extractError(err) });
  }
}

function confirmRemove(room: ISecretaryRoom): void {
  $q.dialog({
    title: 'Удалить комнату секретаря?',
    message: `Секретарь выйдет из «${room.displayLabel}», комната перестанет транскрибироваться и синхронизироваться.`,
    cancel: { label: 'Отмена', flat: true, noCaps: true },
    ok: { label: 'Удалить', color: 'negative', noCaps: true, unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await store.removeRoom(room.id);
      $q.notify({ type: 'positive', message: 'Комната удалена' });
    } catch (err) {
      $q.notify({ type: 'negative', message: extractError(err) });
    }
  });
}

function extractError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Не удалось выполнить операцию';
}

async function handleRefresh(): Promise<void> {
  await store.loadRooms();
}

onMounted(async () => {
  await store.loadRooms();
});
</script>

<style scoped>
.sr-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.sr-head__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.sr-head__subtitle {
  margin: 6px 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: rgba(0, 0, 0, 0.55);
  max-width: 48rem;
}

.body--dark .sr-head__subtitle {
  color: rgba(255, 255, 255, 0.55);
}

.sr-head__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sr-name {
  font-weight: 500;
  line-height: 1.35;
}

.sr-dialog {
  width: 460px;
  max-width: 90vw;
}
</style>
