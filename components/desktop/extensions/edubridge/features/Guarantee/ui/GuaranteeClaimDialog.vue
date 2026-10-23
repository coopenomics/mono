<template lang="pug">
//- Заявление об аннулировании подписки по гарантийным условиям: причина, материалы, подпись.
BaseDialog(:model-value="modelValue" :title="$t('edubridge.guaranteeClaim.dialogTitle')" size="md" @update:model-value="(v) => emit('update:modelValue', v)")
  BaseForm(:loading="busy" @submit="onSubmit")
    DataRow(:label="$t('edubridge.guaranteeClaim.refundLabel')" :value="formatAsset2Digits(state?.amount ?? '')" align="spread")
    BaseInput.q-mt-md(v-model="reason" :label="$t('edubridge.guaranteeClaim.reasonLabel')" type="textarea" :rows="4" required)
    BaseInput(v-model="linksText" :label="$t('edubridge.guaranteeClaim.linksLabel')" type="textarea" :rows="2" :hint="$t('edubridge.guaranteeClaim.linksHint')")
    template(#footer)
      .row.justify-end.q-gutter-sm
        BaseButton(variant="ghost" type="button" :disabled="busy" @click="emit('update:modelValue', false)") {{ $t('edubridge.guaranteeClaim.cancel') }}
        BaseButton(variant="primary" type="submit" :loading="busy" :disabled="!reason.trim()") {{ $t('edubridge.guaranteeClaim.submit') }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { asText } from 'src/shared/lib/utils';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseButton, BaseDialog, BaseForm, BaseInput } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { submitGuaranteeClaim, type IGuaranteeState } from '../api';
import { t } from '../../../i18n';

/**
 * Участник аннулирует подписку по гарантийным условиям, пока идёт его
 * гарантийный срок: заявление с причиной рассматривает совет, при
 * удовлетворении вся стоимость возвращается. Окно открывается из меню
 * подписки в «Моих подписках».
 */
const props = defineProps<{ modelValue: boolean; state: IGuaranteeState | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; submitted: [] }>();

const reason = ref('');
const linksText = ref('');
const busy = ref(false);

// Каждое открытие — чистая форма: причина прошлой попытки к другой подписке не относится.
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    reason.value = '';
    linksText.value = '';
  },
);

async function onSubmit(): Promise<void> {
  if (!props.state) return;
  busy.value = true;
  try {
    const links = linksText.value.split('\n').map((l) => l.trim()).filter(Boolean);
    await submitGuaranteeClaim({ enrollment_id: asText(props.state.enrollment_id), reason: reason.value.trim(), links });
    emit('update:modelValue', false);
    SuccessAlert(t('edubridge.guaranteeClaim.success'));
    emit('submitted');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>
