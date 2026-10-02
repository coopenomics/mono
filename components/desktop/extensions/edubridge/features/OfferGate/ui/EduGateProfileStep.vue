<template lang="pug">
.edu-gate-profile
  .text-body2.q-mb-md {{ $t('edubridge.eduGateProfileStep.description') }}

  BaseForm(:loading="busy" @submit="submit")
    //- Закреплённая договором ставка показывается, но не правится: её меняет администратор.
    BaseInput(
      v-model="rate"
      :label="$t('edubridge.eduGateProfileStep.rateLabel')"
      :hint="rateLocked ? $t('edubridge.eduGateProfileStep.rateLockedHint') : $t('edubridge.eduGateProfileStep.rateHint')"
      type="number"
      :suffix="symbol"
      :disabled="rateLocked"
      required
    )
    BaseInput.q-mt-md(
      v-model="about"
      :label="$t('edubridge.eduGateProfileStep.aboutLabel')"
      :hint="$t('edubridge.eduGateProfileStep.aboutHint')"
      :placeholder="$t('edubridge.eduGateProfileStep.aboutPlaceholder')"
      type="textarea"
      :rows="5"
      autogrow
      stack-label
      required
    )
    template(#footer)
      .row.justify-end
        BaseButton(variant="primary" type="submit" :disabled="!ready" :loading="busy") {{ $t('edubridge.eduGateProfileStep.submit') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert } from 'src/shared/api';
import { formatToAsset } from 'src/shared/lib/utils';
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { saveTeacherProfile, type ITeacherProfile } from '../../../entities/Teacher';

/**
 * Первый шаг подключения преподавателя: ставка за час и рассказ о себе. С них
 * начинается разговор с кооперативом — оферта и договор идут следом, а
 * рассказ остаётся в профиле преподавателя.
 */
const props = defineProps<{
  /** Уже сохранённый профиль — при возврате к шагу поля заполнены. */
  profile: ITeacherProfile | null;
  /** Символ валюты ставки. */
  symbol: string;
}>();
const emit = defineEmits<{ saved: [profile: ITeacherProfile] }>();

/** «1000.0000 RUB» → «1000»; не названная ставка — пустое поле. */
const rateNumber = (asset?: string | null): string => {
  const value = Number.parseFloat(String(asset ?? ''));
  return value > 0 ? String(value) : '';
};

const rate = ref(rateNumber(props.profile?.hourly_rate));
const about = ref(props.profile?.about ?? '');
const busy = ref(false);

const rateLocked = computed(() => Boolean(props.profile?.rate_locked));
const ready = computed(() => Number(String(rate.value).replace(',', '.')) > 0 && about.value.trim().length > 0);

// Профиль дочитался после открытия шага — подставляем, пока человек ничего не ввёл.
watch(
  () => props.profile,
  (profile) => {
    if (!rate.value) rate.value = rateNumber(profile?.hourly_rate);
    if (!about.value) about.value = profile?.about ?? '';
  },
);

async function submit(): Promise<void> {
  if (!ready.value) return;
  busy.value = true;
  try {
    const saved = await saveTeacherProfile({
      about: about.value.trim(),
      // Закреплённую ставку не шлём: сервер оставит ту, что в договоре.
      ...(rateLocked.value ? {} : { hourly_rate: formatToAsset(String(rate.value).replace(',', '.'), props.symbol) }),
    });
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>
