<template>
  <EntityDetailPage
    :title="isNew ? 'Добавить человека' : (person ? [person.last_name, person.first_name, person.middle_name].filter(Boolean).join(' ') || 'Человек' : 'Человек')"
    :loading="loading && !isNew"
    :error="error"
    :deleted-at="person?.deleted_at"
    :tabs="isNew ? [] : tabs"
    :active-tab="activeTab"
    list-path="/person"
    :saving="saving"
    :hide-info="isNew"
    :hide-delete="isNew || !!person?.deleted_at"
    :info-data="person"
    @save="handleSaveClick"
    @delete="handleDelete"
    @retry="loadPerson"
    @update:active-tab="(val: string) => activeTab = val"
  >
    <!-- Таб: Основное -->
    <div v-show="isNew || activeTab === 'general'">
      <q-card class="page-detail-card" flat style="max-width: 700px">
        <q-card-section>
          <q-form ref="personFormRef" @submit="handleSave">

            <!-- ФИО -->
            <div class="row q-col-gutter-md form-row">
              <div class="col-12 col-md-4">
                <q-input v-model="formData.last_name" label="Фамилия" filled hide-bottom-space />
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model="formData.first_name"
                  label="Имя"
                  filled
                  hide-bottom-space
                  :rules="[(v) => !!v || 'Обязательное поле']"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-input v-model="formData.middle_name" label="Отчество" filled hide-bottom-space />
              </div>
            </div>

            <!-- Дата рождения -->
            <div class="form-field">
              <q-input v-model="formData.birth_date" label="Дата рождения" filled hide-bottom-space type="date">
                <template #prepend>
                  <q-icon name="event" size="20px" style="opacity: 0.7" />
                </template>
              </q-input>
            </div>

            <!-- Описание -->
            <div class="form-field">
              <MarkdownEditor
                :model-value="formData.description ?? ''"
                label="Описание"
                language="ru-RU"
                height="300px"
                @update:model-value="(val) => (formData.description = val || null)"
              />
            </div>

          </q-form>
        </q-card-section>
      </q-card>
    </div>

    <!-- Таб: Контакты -->
    <div v-show="activeTab === 'contacts'">
      <q-card class="page-detail-card page-detail-card--narrow" flat>
        <q-card-section>
          <ContactManager v-if="person" :person-id="person.id" />
        </q-card-section>
      </q-card>
    </div>

  </EntityDetailPage>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import EntityDetailPage from '@/shared/ui/EntityDetailPage.vue'
import { MarkdownEditor } from '@/shared/ui/md'
import ContactManager from 'widget/contact/ContactManager.vue'
import { personApi } from '@/shared/api'
import type { Person } from '@/entities/person'

const router = useRouter()
const route = useRoute()
const $q = useQuasar()

const isNew = computed(() => route.params.id === 'new')

const activeTab = ref('general')
const tabs: { label: string; value: string }[] = [
  { label: 'Основное', value: 'general' },
  { label: 'Контакты', value: 'contacts' },
]

const person = ref<Person | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const personFormRef = ref<{ submit: () => void } | null>(null)

const handleSaveClick = () => {
  personFormRef.value?.submit()
}

const formData = reactive({
  first_name: '',
  last_name: '' as string | null,
  middle_name: '' as string | null,
  birth_date: '' as string | null,
  description: '' as string | null,
})

const loadPerson = async () => {
  const personId = Number(route.params.id)
  if (isNaN(personId)) { error.value = 'Некорректный ID'; return }

  loading.value = true
  error.value = null
  try {
    person.value = await personApi.getById(personId)
    if (person.value) {
      Object.assign(formData, {
        first_name: person.value.first_name,
        last_name: person.value.last_name ?? '',
        middle_name: person.value.middle_name ?? '',
        birth_date: person.value.birth_date ?? '',
        description: person.value.description ?? '',
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при загрузке данных'
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  error.value = null
  try {
    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name || null,
      middle_name: formData.middle_name || null,
      birth_date: formData.birth_date || null,
      description: formData.description || null,
    }
    if (isNew.value) {
      const created = await personApi.create(payload)
      $q.notify({ type: 'positive', message: 'Человек успешно добавлен' })
      await router.push(`/person/${created.id}`)
      // Загружаем данные после создания
      person.value = await personApi.getById(created.id)
      if (person.value) {
        Object.assign(formData, {
          first_name: person.value.first_name,
          last_name: person.value.last_name ?? '',
          middle_name: person.value.middle_name ?? '',
          birth_date: person.value.birth_date ?? '',
          description: person.value.description ?? '',
        })
      }
    } else {
      await personApi.update(Number(route.params.id), payload)
      $q.notify({ type: 'positive', message: 'Данные успешно сохранены' })
      await loadPerson()
    }
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка при сохранении' })
  } finally {
    saving.value = false
  }
}

const handleDelete = () => {
  if (!person.value) return
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Удалить ${person.value.first_name} ${person.value.last_name ?? ''}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await personApi.deleteById(person.value!.id)
        $q.notify({ type: 'positive', message: 'Человек успешно удалён' })
        void router.push('/person')
      } catch {
        $q.notify({ type: 'negative', message: 'Ошибка при удалении' })
      }
    })()
  })
}

onMounted(() => { if (!isNew.value) void loadPerson() })
</script>

<style scoped lang="scss">
.form-field {
  padding: 0.5rem 0;
}

.form-row {
  padding: 0.5rem 0;
}
</style>
