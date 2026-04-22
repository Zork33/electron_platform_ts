<template>
  <EntityListPage
    title="Персоны"
    add-path="/person/new"
    :columns="columns"
    :rows="items"
    :loading="loading"
    :error="error"
    :show-deleted="showDeleted"
    empty-title="Пока нет персон"
    empty-message="Добавьте первую персону, чтобы начать работу"
    @toggle-show-deleted="toggleShowDeleted"
    @row-click="(row) => router.push(`/person/${row.id}`)"
    @retry="fetchItems(showDeleted)"
  >
    <template #body-cell-actions="{ row }">
      <q-btn flat round icon="more_vert" size="sm" @click.stop>
        <q-menu anchor="bottom right" self="top right" auto-close>
          <q-list dense style="min-width: 160px">
            <q-item clickable @click="router.push(`/person/${row.id}`)">
              <q-item-section avatar><q-icon name="edit" size="xs" /></q-item-section>
              <q-item-section>Редактировать</q-item-section>
            </q-item>
            <q-item clickable @click="router.push({ path: '/passport_rf', query: { person_id: row.id } })">
              <q-item-section avatar><q-icon name="badge" size="xs" /></q-item-section>
              <q-item-section>Паспорта</q-item-section>
            </q-item>
            <q-separator v-if="!row.deleted_at" />
            <q-item v-if="!row.deleted_at" clickable class="text-negative" @click="confirmDelete(row)">
              <q-item-section avatar><q-icon name="delete" size="xs" color="negative" /></q-item-section>
              <q-item-section>Удалить</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </template>
  </EntityListPage>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar, type QTableColumn } from 'quasar'
import EntityListPage from '@/shared/ui/EntityListPage.vue'
import { usePerson, type Person } from '@/entities/person'

const $q = useQuasar()
const router = useRouter()
const {
  items,
  loading,
  error,
  showDeleted,
  fetchItems,
  deleteItem,
  toggleShowDeleted,
  getFullName,
  formatBirthDate,
} = usePerson()

const columns: QTableColumn[] = [
  { name: 'id', label: 'ID', field: 'id', sortable: true, align: 'left', style: 'width: 80px' },
  { name: 'full_name', label: 'ФИО', field: (row: Person) => getFullName(row), sortable: true, align: 'left' },
  { name: 'birth_date', label: 'Дата рождения', field: (row: Person) => formatBirthDate(row.birth_date) ?? '—', align: 'left' },
  { name: 'created_at', label: 'Создан', field: (row: Person) => new Date(row.created_at ?? '').toLocaleDateString('ru-RU'), align: 'left' },
  { name: 'actions', label: '', field: 'id', align: 'right', style: 'width: 48px' },
]

onMounted(() => void fetchItems(false))

const confirmDelete = (person: Person) => {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы действительно хотите удалить ${getFullName(person)}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    deleteItem(person.id)
      .then(() => $q.notify({ type: 'positive', message: 'Успешно удалена' }))
      .catch(() => $q.notify({ type: 'negative', message: 'Ошибка при удалении' }))
  })
}
</script>
