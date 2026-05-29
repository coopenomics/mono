<template lang="pug">
div
  q-btn(
    color='primary',
    @click='showDialog = true',
    :loading='loading',
    label='Внести результат'
  )

  BaseDialog(
    v-model='showDialog',
    title='Подтверждение внесения результата',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    .q-pa-md
      ColorCard(color='green')
        .card-label Ваш паевой взнос
        .card-value {{ contributionAmount }}

      ColorCard(color='orange', v-if='parseFloat(debtAmount) > 0')
        .card-label Сумма погашаемой ссуды
        .card-value {{ debtAmount }}

    Form.q-pa-md(
      :handler-submit='handlePushResult',
      :is-submitting='isSubmitting',
      :button-submit-txt='"Подтвердить внесение"',
      :button-cancel-txt='"Отмена"',
      @cancel='clear'
    )

    .q-pa-md.text-center
      p.text-caption Подтверждая внесение результата, вы соглашаетесь с генерацией и подписью заявления на паевой взнос
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePushResult } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { ColorCard } from 'src/shared/ui/ColorCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import type { ISegment } from 'app/extensions/capital/entities/Segment/model';

interface Props {
  segment: ISegment;
}

const props = defineProps<Props>();

const { pushResultWithGeneratedStatement } = usePushResult();

const loading = ref(false);
const showDialog = ref(false);
const isSubmitting = ref(false);

// Вычисляемые суммы
const contributionAmount = computed(() => {
  if (!props.segment) return '0.00';

  return formatAsset2Digits(
    props.segment.intellectual_cost
  );
});

const debtAmount = computed(() => {
  if (!props.segment || !props.segment.debt_amount) return '0.00';

  return formatAsset2Digits(props.segment.debt_amount);
});


const clear = () => {
  showDialog.value = false;
  isSubmitting.value = false;
};

const handlePushResult = async () => {
  try {
    isSubmitting.value = true;

    // Отправляем результат с генерацией и подписью заявления
    await pushResultWithGeneratedStatement(
      props.segment.project_hash,
      props.segment.username,
    );

    SuccessAlert('Заявление отправлено в совет на рассмотрение');
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
