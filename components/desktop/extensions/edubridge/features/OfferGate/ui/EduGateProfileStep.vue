<template lang="pug">
.edu-gate-profile
  .text-body2.q-mb-md {{ $t('edubridge.eduGateProfileStep.description') }}

  BaseForm(:loading="busy" @submit="submit")
    BaseInput(
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
import { BaseButton, BaseForm, BaseInput } from 'src/shared/ui/base';
import { saveTeacherProfile, type ITeacherProfile } from '../../../entities/Teacher';

/**
 * Первый шаг подключения преподавателя: рассказ о себе. С него начинается
 * разговор с кооперативом — оферта и договор идут следом, а рассказ остаётся
 * в профиле преподавателя. Ставку за час назначает администратор.
 */
const props = defineProps<{
  /** Уже сохранённый профиль — при возврате к шагу поле заполнено. */
  profile: ITeacherProfile | null;
}>();
const emit = defineEmits<{ saved: [profile: ITeacherProfile] }>();

const about = ref(props.profile?.about ?? '');
const busy = ref(false);

const ready = computed(() => about.value.trim().length > 0);

// Профиль дочитался после открытия шага — подставляем, пока человек ничего не ввёл.
watch(
  () => props.profile,
  (profile) => {
    if (!about.value) about.value = profile?.about ?? '';
  },
);

async function submit(): Promise<void> {
  if (!ready.value) return;
  busy.value = true;
  try {
    emit('saved', await saveTeacherProfile({ about: about.value.trim() }));
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>
