<template lang="pug">
EduStubPage(
  storage-key="catalog"
  icon="school"
  hint="Каталог курсов кооператива: выберите предмет и класс, откройте карточку курса — расписание, преподаватель, размер членского взноса и учебная программа."
  title="Курсов пока нет"
  body="Как только совет опубликует первые курсы, они появятся здесь."
)
</template>

<script setup lang="ts">
import { EduStubPage } from '../../shared/ui/EduStubPage';
</script>
