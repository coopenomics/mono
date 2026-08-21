<template lang="pug">
//- Сверка личности с документом перед подтверждением. Данные пайщика
//- запрашиваются у сервера в момент открытия окна: постоянного доступа к
//- персональным данным ни у оператора участка, ни у совета нет.
VerificationConfirmDialog(
  :model-value='modelValue',
  :full-name='identity?.full_name || fullName',
  :username='username',
  :hint='hint',
  size='md',
  :loading='verifying',
  @update:model-value='(value) => emit("update:modelValue", value)',
  @confirm='onConfirm'
)
  .verify-dialog__facts(v-if='loadingIdentity')
    q-skeleton(type='text', width='70%')
    q-skeleton(type='text', width='55%')
    q-skeleton(type='text', width='60%')
  .verify-dialog__facts(v-else-if='facts.length')
    DataRow(
      v-for='fact in facts',
      :key='fact.label',
      :label='fact.label',
      :value='fact.value',
      :align='fact.wide ? "vertical" : "horizontal"'
    )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DataRow, VerificationConfirmDialog } from 'src/shared/ui/domain';
import { FailAlert } from 'src/shared/api';
import { formatDocumentDate } from 'src/shared/lib/utils/dates';
import { verificationHint, verificationIdentityFacts } from 'src/shared/lib/verification';
import { api, type IParticipantIdentity } from '../api';
import { useVerifyIdentity } from '../model';

const props = defineProps<{
  modelValue: boolean;
  /** Имя аккаунта пайщика, чью личность сверяют. */
  username: string;
  /** ФИО из уже загруженных данных — показываем, пока грузится сверка. */
  fullName?: string;
  /** Участок, где идёт сверка; пусто — сверяет совет кооператива. */
  braname?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'verified'): void;
}>();

const { verify, loading: verifying } = useVerifyIdentity();
const identity = ref<IParticipantIdentity | null>(null);
const loadingIdentity = ref(false);

const facts = computed(() =>
  identity.value ? verificationIdentityFacts(identity.value, formatDocumentDate) : [],
);

const hint = computed(() => verificationHint(identity.value?.type ?? ''));

// Данные грузим на открытие окна и забываем на закрытие: они нужны ровно на
// время сверки. Отказ сервера (личность уже подтверждена, нет полномочий)
// закрывает окно — показывать пустую форму подтверждения нечестно.
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      identity.value = null;
      return;
    }
    loadingIdentity.value = true;
    try {
      identity.value = await api.getIdentityForVerification({
        username: props.username,
        ...(props.braname ? { braname: props.braname } : {}),
      });
    } catch (error: any) {
      FailAlert(error);
      emit('update:modelValue', false);
    } finally {
      loadingIdentity.value = false;
    }
  },
);

const onConfirm = async () => {
  if (await verify(props.username, props.braname)) {
    emit('update:modelValue', false);
    emit('verified');
  }
};
</script>

<style scoped lang="scss">
.verify-dialog__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}
</style>
