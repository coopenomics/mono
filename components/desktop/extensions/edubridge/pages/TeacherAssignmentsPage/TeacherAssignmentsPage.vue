<template lang="pug">
EduStubPage(
  storage-key="teacher-assignments"
  icon="assignment"
  hint="Ваши назначения: курс, расписание, ожидаемый результат и период сдачи. Взнос результатами работы оформляется отсюда."
  title="Назначений пока нет"
  body="Администратор ещё не назначил вам курс."
)
</template>

<script setup lang="ts">
import { EduStubPage } from '../../shared/ui/EduStubPage';
</script>
