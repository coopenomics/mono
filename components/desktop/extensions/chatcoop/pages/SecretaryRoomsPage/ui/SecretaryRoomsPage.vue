<template lang="pug">
q-page.secretary-rooms-page(padding)
  header.sr-head
    div.sr-head__text
      h1.sr-head__title {{ $t('chatcoop.secretaryRoomsPage.pageTitle') }}
      p.sr-head__subtitle
        | {{ $t('chatcoop.secretaryRoomsPage.pageSubtitle') }}
        | {{ $t('chatcoop.secretaryRoomsPage.pageHint') }}
    .sr-head__actions
      q-btn(
        unelevated
        no-caps
        color="primary"
        icon="fa-solid fa-plus"
        :label="$t('chatcoop.secretaryRoomsPage.createRoomLabel')"
        @click="openCreateDialog"
      )
      q-btn.sr-head__refresh(
        flat
        round
        dense
        icon="fa-solid fa-rotate-right"
        @click="handleRefresh"
        :loading="store.isLoading"
        :aria-label="$t('chatcoop.secretaryRoomsPage.refreshAriaLabel')"
      )
        q-tooltip {{ $t('chatcoop.secretaryRoomsPage.refreshLabel') }}

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
    :no-data-label="$t('chatcoop.secretaryRoomsPage.emptyLabel')"
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
          q-tooltip {{ props.row.secretaryInRoom ? $t('chatcoop.secretaryRoomsPage.secretaryPresentLabel') : $t('chatcoop.secretaryRoomsPage.secretaryAbsentLabel') }}
        q-icon.q-ml-sm(
          v-if="props.row.encrypted"
          name="fa-solid fa-lock"
          color="orange-8"
          size="16px"
        )
          q-tooltip {{ $t('chatcoop.secretaryRoomsPage.encryptedRoomHint') }}
    template(#body-cell-actions="props")
      q-td(:props="props" align="right")
        q-btn(
          v-if="props.row.editable"
          flat
          dense
          no-caps
          color="negative"
          icon="fa-solid fa-trash"
          :label="$t('common.action.delete')"
          @click="confirmRemove(props.row)"
        )
        span.text-grey-5(v-else) —

  //- Диалог создания комнаты
  q-dialog(v-model="createDialog")
    q-card.sr-dialog
      q-card-section
        .text-h6 {{ $t('chatcoop.secretaryRoomsPage.createDialogTitle') }}
      q-card-section.q-pt-none
        q-input(
          v-model="form.displayName"
          :label="$t('chatcoop.secretaryRoomsPage.nameLabel')"
          autofocus
          :rules="[(v) => !!v && v.trim().length > 0 || $t('chatcoop.secretaryRoomsPage.namePlaceholder')]"
          maxlength="240"
        )
        .sr-type.q-mt-md
          .text-subtitle2.q-mb-xs {{ $t('chatcoop.secretaryRoomsPage.typeLabel') }}
          q-option-group(
            v-model="form.isPublic"
            :options="typeOptions"
            color="primary"
            type="radio"
          )
          .text-caption.text-grey-7.q-mt-xs
            | {{ form.isPublic ? $t('chatcoop.secretaryRoomsPage.publicTypeHint') : $t('chatcoop.secretaryRoomsPage.privateTypeHint') }}
      q-card-actions(align="right")
        q-btn(flat no-caps :label="$t('common.action.cancel')" v-close-popup :disable="store.isMutating")
        q-btn(
          unelevated
          no-caps
          color="primary"
          :label="$t('common.action.create')"
          :loading="store.isMutating"
          @click="submitCreate"
        )
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useSecretaryRoomStore } from '../../../entities/SecretaryRoom';
import type { ISecretaryRoom } from '../../../entities/SecretaryRoom';
import { t, t as i18nT } from '../../../i18n';

const $q = useQuasar();
const store = useSecretaryRoomStore();

const createDialog = ref(false);
const form = ref<{ displayName: string; isPublic: boolean }>({
  displayName: '',
  isPublic: false,
});

const typeOptions = [
  { label: t('chatcoop.secretaryRoomsPage.privateTypeOption'), value: false },
  { label: t('chatcoop.secretaryRoomsPage.publicTypeOption'), value: true },
];

const columns = [
  {
    name: 'displayLabel',
    label: t('chatcoop.secretaryRoomsPage.column.room'),
    field: 'displayLabel',
    align: 'left' as const,
    style: 'min-width: 320px;',
  },
  { name: 'kind', label: t('chatcoop.secretaryRoomsPage.column.kind'), field: 'kind', align: 'left' as const },
  { name: 'secretary', label: t('chatcoop.secretaryRoomsPage.column.secretary'), field: 'secretaryInRoom', align: 'left' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
];

function kindLabel(kind: ISecretaryRoom['kind']): string {
  switch (kind) {
    case 'MEMBERS':
      return t('chatcoop.secretaryRoom.status.members');
    case 'COUNCIL':
      return t('chatcoop.secretaryRoom.status.council');
    case 'CAPITAL_PROJECT':
      return t('chatcoop.secretaryRoom.status.capitalProject');
    case 'SECRETARY':
      return t('chatcoop.secretaryRoom.status.secretary');
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
    $q.notify({ type: 'positive', message: t('chatcoop.secretaryRoomsPage.createdMessage') });
  } catch (err) {
    $q.notify({ type: 'negative', message: extractError(err) });
  }
}

function confirmRemove(room: ISecretaryRoom): void {
  $q.dialog({
    title: t('chatcoop.secretaryRoomsPage.deleteConfirmTitle'),
    message: t('chatcoop.secretaryRoomsPage.deleteConfirmMessage', { roomName: room.displayLabel }),
    cancel: { label: i18nT('common.action.cancel'), flat: true, noCaps: true },
    ok: { label: i18nT('common.action.delete'), color: 'negative', noCaps: true, unelevated: true },
    persistent: true,
  }).onOk(async () => {
    try {
      await store.removeRoom(room.id);
      $q.notify({ type: 'positive', message: t('chatcoop.secretaryRoomsPage.deletedMessage') });
    } catch (err) {
      $q.notify({ type: 'negative', message: extractError(err) });
    }
  });
}

function extractError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return t('chatcoop.secretaryRoomsPage.operationError');
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
