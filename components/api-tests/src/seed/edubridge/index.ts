/**
 * Засев стенда для сценариев документации «Образования» (docs-harness,
 * scenarios/edubridge). Запуск:
 *
 *   pnpm --filter @coopenomics/boot exec esno components/api-tests/src/seed/edubridge/index.ts <фаза> [<фаза> …] | all
 *
 * Сценарии заявляют фазы в meta.prepare (формат `edubridge:<фаза>`), раннер
 * сюиты гоняет их до прогона. Каждая фаза идемпотентна: повторный запуск на
 * том же стенде — no-op.
 *
 * Зачем здесь, а не в boot: всё, что фазам нужно, — подключение ЦПП советом,
 * оферты, договор преподавателя с подписью председателя, подписка, отчёт о
 * занятии — уже собрано помощниками внешнего слоя тестов (edubridge.helpers)
 * и проверено наборами. Вторая реализация в boot разошлась бы с первой.
 *
 * Пайщики берутся из фикстур docs-harness (state/participants/<имя>.json) —
 * имена человеческие, они попадают в кадры документации.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import type { Who } from '../../core/auth'
import { tokenOf } from '../../core/auth'
import { gql, gqlRaw } from '../../core/client'
import { REPO_ROOT } from '../../core/env'
import { CHAIRMAN } from '../../core/roles'
import { waitFor } from '../../core/wait'
import {
  ADD_LEARNER,
  CATALOG_PAGE,
  CREATE_ASSIGNMENT,
  MY_ASSIGNMENTS,
  MY_CONTRACT,
  MY_ENROLLMENTS,
  MY_LEARNERS,
  MY_LESSONS,
  PLANNED_RATE,
  SAVE_SECTION,
  SHARE_WALLET,
  dayFromNow,
  educationOn,
  fundShare,
  holdMaterials,
  offersState,
  onboardTeacher,
  publishCourse,
  reportLesson,
  signOffer,
  subscribe,
  walletOf,
} from '../../edubridge/edubridge.helpers'

const log = (...a: unknown[]) => console.error('[seed-edubridge]', ...a)

// ── Состав стенда документации ─────────────────────────────────────────────
// Всё, что ниже, видно на кадрах: имена, названия, суммы.
export const SECTION_TITLE = 'Математика'
export const LEVEL_TITLE = '9 класс'
export const COURSE_TITLE = 'Подготовка к ОГЭ по математике'
export const COURSE_DESCRIPTION = 'Разбор всех заданий первой и второй части, пробные варианты каждые две недели, домашние задания с проверкой.'
export const COURSE_SYLLABUS = '1. Числа и вычисления\n2. Алгебраические выражения\n3. Уравнения и неравенства\n4. Функции и графики\n5. Геометрия: треугольники и окружности\n6. Статистика и вероятность\n7. Пробные варианты и разбор'
export const COURSE_SCHEDULE = 'Вт, Чт 17:00–18:30'
export const TEACHER = 'orlova'
export const TEACHER_ABOUT = 'Преподаю математику в 5–9 классах, 12 лет в школе, готовлю к ОГЭ. Выпускники сдают на 4 и 5.'
export const PARENT = 'gromova'
export const LEARNER_NAME = 'Громов Артём Николаевич'
export const LEARNER_PASS = 'ПР-2041'
/** Паевой взнос ученика на стенде: подписка фазы и вторая подписка сценарием, с запасом на продление. */
export const PARENT_FUNDS = 60_000

const SECTIONS = 'query($f:EduSectionsFilterInput){ edubridgeSections(filter:$f){ id title levels{ id title } } }'
const SAVE_LEVEL = 'mutation($d:EduSaveLevelInput!){ edubridgeSaveLevel(data:$d){ id title } }'

/** Пайщик из фикстуры docs-harness. */
function fixture(name: string): Who {
  const file = path.join(REPO_ROOT, 'components/docs-harness/state/participants', `${name}.json`)
  if (!fs.existsSync(file))
    throw new Error(`фикстуры ${name} нет (${file}) — раннер сюиты заводит пайщиков до фаз засева`)
  const f = JSON.parse(fs.readFileSync(file, 'utf8'))
  return { account: f.username, email: f.email, wif: f.wif }
}

async function findCourse(token: string): Promise<any | undefined> {
  const d = await gql<any>(token, CATALOG_PAGE, { f: {} })
  return (d.edubridgeCatalog.items as any[]).find(c => c.title === COURSE_TITLE)
}

// ── Фазы ───────────────────────────────────────────────────────────────────

/** 01 — приложение установлено, совет утвердил положение, оферты и договор, формы документов утверждены. */
async function phase01(): Promise<void> {
  await educationOn()
  log('ЦПП «Образование» подключена, формы документов утверждены')
}

/** 02 — раздел «Математика» с уровнем и опубликованный курс, занятия с сегодняшнего дня. */
async function phase02(): Promise<void> {
  const chairman = await tokenOf(CHAIRMAN)
  const sections = (await gql<any>(chairman, SECTIONS, { f: {} })).edubridgeSections as any[]
  let section = sections.find(s => s.title === SECTION_TITLE)
  if (!section) {
    section = (await gql<any>(chairman, SAVE_SECTION, { d: { title: SECTION_TITLE } })).edubridgeSaveSection
    log(`раздел «${SECTION_TITLE}» создан`)
  }
  const levels = (section.levels ?? []) as any[]
  let level = levels.find(l => l.title === LEVEL_TITLE)
  if (!level) {
    try {
      level = (await gql<any>(chairman, SAVE_LEVEL, { d: { section_id: section.id, title: LEVEL_TITLE } })).edubridgeSaveLevel
      log(`уровень «${LEVEL_TITLE}» создан`)
    }
    catch (e) {
      // Уровень — удобство каталога; без него курс всё равно публикуется.
      log(`уровень не создан: ${(e as Error).message}`)
    }
  }
  if (await findCourse(chairman)) {
    log(`курс «${COURSE_TITLE}» уже опубликован`)
    return
  }
  const course = await publishCourse(chairman, section.id, 0, {
    title: COURSE_TITLE,
    description: COURSE_DESCRIPTION,
    syllabus: COURSE_SYLLABUS,
    schedule: COURSE_SCHEDULE,
    // Два окна по полтора часа в неделю, программа четыре месяца.
    schedule_slots: [{ weekday: 2, time: '18:00', minutes: 90 }, { weekday: 4, time: '18:00', minutes: 90 }],
    program_months: 4,
    planned_hourly_rate: PLANNED_RATE,
    guarantee_days: 14,
    course_payment_enabled: true,
    course_discount_percent: 10,
    ...(level ? { level_id: level.id } : {}),
  })
  log(`курс «${course.title}» опубликован, взнос в месяц ${course.fee_month}`)
}

/** 03 — преподаватель подключён (оферта, договор с подписью председателя, ставка) и допущен к курсу. */
async function phase03(): Promise<void> {
  const who = fixture(TEACHER)
  const token = await tokenOf(who)
  // До оферты запрос договора отказывает (EDUBRIDGE_TEACHER_OFFER_REQUIRED) — это «договора нет».
  const probe = await gqlRaw<any>(token, MY_CONTRACT)
  const contract = probe.errors.length ? null : probe.data?.edubridgeMyContract
  if (contract?.status === 'ACTIVE') {
    log(`${TEACHER}: договор № ${contract.contract_number} действует`)
  }
  else {
    await onboardTeacher(who, token, PLANNED_RATE, { about: TEACHER_ABOUT })
    log(`${TEACHER}: оферта и договор подписаны, председатель подписал договор`)
  }
  const chairman = await tokenOf(CHAIRMAN)
  const course = await waitFor(() => findCourse(chairman), { timeoutMs: 30_000, label: `курс «${COURSE_TITLE}» в каталоге` })
  const mine = (await gql<any>(token, MY_ASSIGNMENTS)).edubridgeMyAssignments as any[]
  if (mine.some(a => a.course_id === course.id && a.status === 'ACTIVE')) {
    log(`${TEACHER}: назначение на курс уже действует`)
    return
  }
  await gql(chairman, CREATE_ASSIGNMENT, {
    d: {
      teacher_username: who.account,
      course_id: course.id,
      period_from: dayFromNow(0),
      period_to: dayFromNow(240),
      schedule: COURSE_SCHEDULE,
      expected_result: 'Ученики решают первую часть ОГЭ без ошибок и две задачи второй части.',
    },
  })
  log(`${TEACHER}: допущена к курсу «${COURSE_TITLE}»`)
}

/** 04 — ученик подписал оферту, завёл обучающегося, внёс паевой взнос и подписался на курс. */
async function phase04(): Promise<void> {
  const who = fixture(PARENT)
  const token = await tokenOf(who)
  const state = await offersState(token)
  if (state.parent.signed_at) {
    log(`${PARENT}: оферта ученика подписана ${state.parent.signed_at}`)
  }
  else {
    await signOffer(who, token, 'PARENT')
    log(`${PARENT}: оферта ученика подписана`)
  }
  const learners = (await gql<any>(token, MY_LEARNERS)).edubridgeMyLearners as any[]
  let learner = learners.find(l => l.display_name === LEARNER_NAME)
  if (!learner) {
    learner = (await gql<any>(token, ADD_LEARNER, {
      d: { display_name: LEARNER_NAME, recipient_type: 'ONSITE', recipient_value: LEARNER_PASS, is_self: false },
    })).edubridgeAddLearner
    log(`${PARENT}: обучающийся «${LEARNER_NAME}» добавлен`)
  }
  const chairman = await tokenOf(CHAIRMAN)
  const course = await waitFor(() => findCourse(chairman), { timeoutMs: 30_000, label: `курс «${COURSE_TITLE}» в каталоге` })
  const enrollments = (await gql<any>(token, MY_ENROLLMENTS)).edubridgeMyEnrollments as any[]
  if (enrollments.some(e => e.course_id === course.id && e.learner_id === learner.id && e.status === 'ACTIVE')) {
    log(`${PARENT}: подписка на курс уже действует`)
    return
  }
  const have = await walletOf(token, who.account, SHARE_WALLET)
  if (have < PARENT_FUNDS) {
    await fundShare(who, token, PARENT_FUNDS - have)
    log(`${PARENT}: паевой взнос пополнен до ${PARENT_FUNDS} ₽`)
  }
  const enrollment = await subscribe(who, token, learner.id, course.id)
  log(`${PARENT}: подписка оформлена, оплачено до ${enrollment.paid_until}`)
}

/** 05 — преподаватель отчиталась о первом занятии и передала материалы на хранение. */
async function phase05(): Promise<void> {
  const who = fixture(TEACHER)
  const token = await tokenOf(who)
  const lessons = (await gql<any>(token, MY_LESSONS)).edubridgeMyLessons as any[]
  if (lessons.length) {
    log(`${TEACHER}: занятий отчитано ${lessons.length}`)
    return
  }
  const assignment = ((await gql<any>(token, MY_ASSIGNMENTS)).edubridgeMyAssignments as any[]).find(a => a.status === 'ACTIVE')
  if (!assignment)
    throw new Error(`${TEACHER}: нет действующего назначения — сначала фаза 03-teacher`)
  // Полночь сегодняшнего дня: контроллер принимает следующее занятие только
  // датой не раньше предыдущего, форма стола шлёт дату без времени (полночь),
  // а раньше начала периода назначения (сегодня) занятие не принимается.
  const { lesson, contribution } = await reportLesson(token, assignment.id, 1, {
    held_at: dayFromNow(0),
    topic: 'Числа и вычисления: действия с дробями',
    materials: ['https://cloud.voskhod.coop/edu/oge-math/01-konspekt.pdf', 'https://cloud.voskhod.coop/edu/oge-math/01-zadaniya.pdf'],
  })
  if (contribution)
    await holdMaterials(who, token, contribution.id)
  log(`${TEACHER}: занятие № ${lesson.lesson_number} отчитано, материалы переданы на хранение`)
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-install': phase01,
  '02-course': phase02,
  '03-teacher': phase03,
  '04-member': phase04,
  '05-lessons': phase05,
}
const ORDER = Object.keys(PHASES)

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (!args.length) {
    console.error(`Usage: seed-edubridge <фаза> [<фаза> …] | all\nФазы: ${ORDER.join(', ')}`)
    process.exit(2)
  }
  const names = args.length === 1 && args[0] === 'all' ? ORDER : args
  for (const name of names) {
    const fn = PHASES[name]
    if (!fn) {
      console.error(`неизвестная фаза ${name}; есть: ${ORDER.join(', ')}`)
      process.exit(2)
    }
    console.error(`\n=== seed-edubridge: ${name} ===`)
    await fn()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
