<template lang="pug">
.user-data-stack
  slot(name="top")
  q-input(ref="firstInput" :autofocus="!slots.top" v-model="data.last_name" outlined color="primary" label="Фамилия" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="data.first_name" outlined color="primary" label="Имя" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="data.middle_name" outlined color="primary" label="Отчество" :rules="[val => validatePersonalName(val)]" autocomplete="off")

  q-input(v-model="data.full_address" outlined color="primary" label="Адрес регистрации (как в паспорте)" :rules="[val => notEmpty(val)]" autocomplete="off")

  q-input(
    outlined color="primary"
    v-model="data.birthdate"
    mask="date"
    label="Дата рождения (год/месяц/день)"
    :rules="['date', val => notEmpty(val)]"
    autocomplete="off"
  )
    template(v-slot:append)
      q-icon(name="event" class="cursor-pointer")
        q-popup-proxy(cover transition-show="scale" transition-hide="scale")
          q-date(v-model="data.birthdate")
            .row.items-center.justify-end
              q-btn(v-close-popup label="Close" color="primary" flat)

  q-input(v-model="data.phone" outlined color="primary" mask="+7 (###) ###-##-##" fill-mask label="Номер телефона" :rules="[val => notEmpty(val), val => notEmptyPhone(val)]" autocomplete="off")
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, useSlots } from 'vue'
import { validatePersonalName, notEmpty, notEmptyPhone } from 'src/shared/lib/utils';
import type { ICreateIndividualData } from './types';

const props = defineProps<{
  data: ICreateIndividualData;
  readonly?: boolean;
}>();

const slots = useSlots();

defineEmits<{
  'update:data': [data: ICreateIndividualData];
}>();

const data = ref<ICreateIndividualData>(props.data);
const firstInput = ref<any>();

onMounted(async () => {
  await nextTick();
  firstInput.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
</script>

<style scoped>
.user-data-stack {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  margin-top: var(--p-4, 16px);
}
</style>
