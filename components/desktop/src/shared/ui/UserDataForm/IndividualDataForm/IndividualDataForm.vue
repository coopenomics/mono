<template lang="pug">
.user-data-stack(v-if="userData.individual_data")
  slot(name="top")
  q-input(ref="firstInput" :autofocus="!slots.top" v-model="userData.individual_data.last_name" outlined dense color="primary" label="Фамилия" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="userData.individual_data.first_name" outlined dense color="primary" label="Имя" :rules="[val => notEmpty(val), val => validatePersonalName(val)]" autocomplete="off")
  q-input(v-model="userData.individual_data.middle_name" outlined dense color="primary" label="Отчество" :rules="[val => validatePersonalName(val)]" autocomplete="off")

  q-input(v-model="userData.individual_data.full_address" outlined dense color="primary" label="Адрес регистрации (как в паспорте)" :rules="[val => notEmpty(val)]" autocomplete="off")

  q-input(
    outlined dense color="primary"
    v-model="userData.individual_data.birthdate"
    mask="date"
    label="Дата рождения (год/месяц/день)"
    :rules="['date', val => notEmpty(val)]"
    autocomplete="off"
  )
    template(v-slot:append)
      q-icon(name="event" class="cursor-pointer")
        q-popup-proxy(cover transition-show="scale" transition-hide="scale")
          q-date(v-model="userData.individual_data.birthdate")
            .row.items-center.justify-end
              q-btn(v-close-popup label="Close" color="primary" flat)

  q-input(v-model="userData.individual_data.phone" outlined dense color="primary" mask="+7 (###) ###-##-##" fill-mask label="Номер телефона" :rules="[val => notEmpty(val), val => notEmptyPhone(val)]" autocomplete="off")

</template>
<script setup lang="ts">
import { ref, onMounted, nextTick, useSlots } from 'vue'
import { validatePersonalName, notEmpty, notEmptyPhone } from 'src/shared/lib/utils';

import type { IUserData } from 'src/shared/lib/types/user/IUserData';

const props = defineProps<{ userData: IUserData }>();
const slots = useSlots();

const userData = ref<IUserData>(props.userData);
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
  /* gap не задаём: reserve-hint-space у q-input уже даёт ~24px снизу под
     error/hint — дополнительный gap делает расстояние избыточным (канон BaseForm). */
  margin-top: var(--p-4, 16px);
}
</style>
