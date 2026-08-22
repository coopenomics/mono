<template lang="pug">
BaseButton(
  variant='primary',
  size='sm',
  :loading='isLoading',
  @click.stop='handleSignAct'
) Подписать акт
</template>

<script setup lang="ts">
import { useSignAct } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseButton } from 'src/shared/ui/base';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';

interface Props {
  segment: ISegment;
  coopname: string;
}

const props = defineProps<Props>();

/** Вторая подпись закрывает акт — список перечитывает строку */
const emit = defineEmits<{ signed: [] }>();

const { signActAsChairman, isLoading } = useSignAct();

/**
 * Обработчик подписания акта председателем (вторая подпись).
 * Председатель накладывает свою подпись на уже подписанный участником акт.
 */
const handleSignAct = async () => {
  try {
    await signActAsChairman(props.segment, props.coopname);
    SuccessAlert('Акт успешно подписан председателем и отправлен');
    emit('signed');
  } catch (error) {
    FailAlert(error);
  }
};
</script>
