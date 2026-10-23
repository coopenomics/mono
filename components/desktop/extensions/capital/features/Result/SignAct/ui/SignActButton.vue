<template lang="pug">
BaseButton(
  variant='primary',
  size='sm',
  :loading='isLoading',
  @click.stop='handleSignAct'
) {{ $t('capital.signActButton.label') }}
</template>

<script setup lang="ts">
import { useSignAct } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseButton } from 'src/shared/ui/base';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';
import { t } from '../../../../i18n';

interface Props {
  segment: ISegment;
  coopname: string;
}

const props = defineProps<Props>();

/** Подпись переводит долю в следующий статус — список перечитывает строку */
const emit = defineEmits<{ signed: [] }>();

const { signActAsContributor, isLoading } = useSignAct();

const handleSignAct = async () => {
  try {
    await signActAsContributor(props.segment, props.coopname);
    SuccessAlert(t('capital.signActButton.success'));
    emit('signed');
  } catch (error) {
    FailAlert(error);
  }
};
</script>
