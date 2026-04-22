<template>
  <div class="contact-phone-list">
    <div class="list-header">
      <div class="list-title">Телефоны</div>
      <q-space />
      <q-btn flat dense round icon="more_vert" size="sm">
        <q-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="handleAdd">
              <q-item-section avatar>
                <q-icon name="add" size="18px" />
              </q-item-section>
              <q-item-section>Добавить</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="showDeleted = !showDeleted">
              <q-item-section avatar>
                <q-icon :name="showDeleted ? 'visibility_off' : 'visibility'" size="18px" />
              </q-item-section>
              <q-item-section>{{ showDeleted ? 'Скрыть удалённые' : 'Показать удалённые' }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <q-linear-progress v-if="loading" indeterminate color="primary" />

    <div v-if="error" class="error-message">
      <q-icon name="error" color="negative" size="20px" />
      <span>{{ error }}</span>
      <q-btn flat dense label="Повторить" @click="loadPhones" />
    </div>

    <div v-else-if="!loading && displayedPhones.length === 0" class="empty-state">
      <q-icon name="phone_disabled" size="32px" color="grey-5" />
      <div class="empty-text">Нет телефонов</div>
    </div>

    <q-list v-else class="phone-list">
      <q-item 
        v-for="item in displayedPhones" 
        :key="item.contactInfo.id" 
        clickable
        class="phone-item"
        :class="{ 'deleted-item': !!item.contactInfo.deleted_at }"
        @click="handleEditItem(item)"
      >
        <q-item-section avatar class="phone-icon" @click.stop="handlePhoneClick">
          <q-icon name="phone" :color="item.contactInfo.deleted_at ? 'grey' : 'primary'" size="20px" style="cursor: pointer" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="phone-number">
            {{ item.phoneNumber.full_number || item.phoneNumber.number || '—' }}
            <q-badge v-if="item.contactInfo.is_primary" color="primary" label="Основной" class="q-ml-sm" />
            <q-badge v-if="item.contactInfo.deleted_at" color="grey" label="Удалён" class="q-ml-sm" />
          </q-item-label>
          <q-item-label v-if="item.contactInfo.description" caption class="phone-description">
            {{ item.contactInfo.description }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-btn 
            flat 
            dense 
            round 
            icon="more_vert" 
            size="sm"
            @click.stop
          >
            <q-menu>
              <q-list dense>
                <q-item clickable v-close-popup @click="handleEditItem(item)">
                  <q-item-section avatar>
                    <q-icon name="edit" size="18px" />
                  </q-item-section>
                  <q-item-section>Редактировать</q-item-section>
                </q-item>
                <q-item 
                  v-if="!item.contactInfo.deleted_at"
                  clickable 
                  v-close-popup 
                  @click="handleDelete(item)"
                >
                  <q-item-section avatar>
                    <q-icon name="delete" color="negative" size="18px" />
                  </q-item-section>
                  <q-item-section>Удалить</q-item-section>
                </q-item>
                <q-item 
                  v-else
                  clickable 
                  v-close-popup 
                  @click="handleRestore(item)"
                >
                  <q-item-section avatar>
                    <q-icon name="restore" color="positive" size="18px" />
                  </q-item-section>
                  <q-item-section>Восстановить</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>

    <ContactPhoneDialog
      ref="addDialogRef"
      v-model="showAddDialog"
      title="Добавить телефон"
      @save="handleSavePhone"
    />

    <ContactPhoneDialog
      ref="editDialogRef"
      v-model="showEditDialog"
      title="Редактировать телефон"
      :initial-data="editingPhone"
      @save="handleUpdatePhone"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { contactInfoApi, phoneNumberApi } from '@/shared/api'
import type { ContactInfo, PhoneNumber } from '@/shared/api'
import ContactPhoneDialog from './ContactPhoneDialog.vue'

interface PhoneItem {
  contactInfo: ContactInfo
  phoneNumber: PhoneNumber
}

interface PhoneFormData {
  full_number: string
  description: string
  is_primary: boolean
}

const props = defineProps<{
  personId?: number | undefined
}>()

const emit = defineEmits<{
  update: []
}>()

const $q = useQuasar()

const loading = ref(false)
const error = ref<string | null>(null)
const contactInfos = ref<ContactInfo[]>([])
const phoneNumbers = ref<PhoneNumber[]>([])
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleted = ref(false)
const editingPhone = ref<PhoneFormData | null>(null)
const editingItem = ref<PhoneItem | null>(null)
const addDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)
const editDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)

const phones = computed<PhoneItem[]>(() => {
  return contactInfos.value
    .filter((ci: ContactInfo) => ci.phone_number_id !== null)
    .map((ci: ContactInfo) => {
      const phoneNumber = phoneNumbers.value.find((pn: PhoneNumber) => pn.id === ci.phone_number_id)
      return phoneNumber ? { contactInfo: ci, phoneNumber } : null
    })
    .filter((item): item is PhoneItem => item !== null)
})

const displayedPhones = computed<PhoneItem[]>(() => {
  if (showDeleted.value) {
    return phones.value
  }
  return phones.value.filter((item: PhoneItem) => !item.contactInfo.deleted_at)
})

const loadPhones = async () => {
  loading.value = true
  error.value = null
  try {
    const allContactInfos = await contactInfoApi.list()
    contactInfos.value = allContactInfos.filter((ci: ContactInfo) => 
      props.personId && ci.person_id === props.personId
    )
    
    const phoneNumberIds = contactInfos.value
      .map((ci: ContactInfo) => ci.phone_number_id)
      .filter((id): id is number => id !== null)
    
    if (phoneNumberIds.length > 0) {
      phoneNumbers.value = await phoneNumberApi.list()
      phoneNumbers.value = phoneNumbers.value.filter((pn: PhoneNumber) => phoneNumberIds.includes(pn.id))
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при загрузке телефонов'
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  showAddDialog.value = true
}

const handleEditItem = (item: PhoneItem) => {
  editingItem.value = item
  editingPhone.value = {
    full_number: item.phoneNumber.full_number || '',
    description: item.contactInfo.description || '',
    is_primary: item.contactInfo.is_primary
  }
  showEditDialog.value = true
}

const handleSavePhone = async (data: PhoneFormData) => {
  if (!addDialogRef.value) return
  
  addDialogRef.value.setSaving(true)
  try {
    const phoneNumber = await phoneNumberApi.create({
      full_number: data.full_number,
      number: data.full_number.replace(/\D/g, '').slice(1)
    })

    await contactInfoApi.create({
      person_id: props.personId || null,
      phone_number_id: phoneNumber.id,
      description: data.description || null,
      is_primary: data.is_primary
    })

    $q.notify({ type: 'positive', message: 'Телефон успешно добавлен' })
    addDialogRef.value.close()
    await loadPhones()
    emit('update')
  } catch (err) {
    $q.notify({ 
      type: 'negative', 
      message: err instanceof Error ? err.message : 'Ошибка при добавлении телефона' 
    })
  } finally {
    addDialogRef.value.setSaving(false)
  }
}

const handleUpdatePhone = async (data: PhoneFormData) => {
  if (!editDialogRef.value || !editingItem.value) return
  
  editDialogRef.value.setSaving(true)
  try {
    await phoneNumberApi.update(editingItem.value.phoneNumber.id, {
      full_number: data.full_number,
      number: data.full_number.replace(/\D/g, '').slice(1)
    })

    await contactInfoApi.update(editingItem.value.contactInfo.id, {
      description: data.description || null,
      is_primary: data.is_primary
    })

    $q.notify({ type: 'positive', message: 'Телефон успешно обновлён' })
    editDialogRef.value.close()
    await loadPhones()
    emit('update')
  } catch (err) {
    $q.notify({ 
      type: 'negative', 
      message: err instanceof Error ? err.message : 'Ошибка при обновлении телефона' 
    })
  } finally {
    editDialogRef.value.setSaving(false)
  }
}

const handleDelete = (item: PhoneItem) => {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Удалить телефон ${item.phoneNumber.full_number || item.phoneNumber.number}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await contactInfoApi.deleteById(item.contactInfo.id)
        $q.notify({ type: 'positive', message: 'Телефон успешно удалён' })
        await loadPhones()
        emit('update')
      } catch {
        $q.notify({ type: 'negative', message: 'Ошибка при удалении' })
      }
    })()
  })
}

const handleRestore = async (item: PhoneItem) => {
  try {
    await contactInfoApi.update(item.contactInfo.id, {
      deleted_at: null
    })
    $q.notify({ type: 'positive', message: 'Телефон успешно восстановлен' })
    await loadPhones()
    emit('update')
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка при восстановлении' })
  }
}

const handlePhoneClick = () => {
  $q.notify({ type: 'info', message: 'Нет настроенных действий для телефона' })
}

const openAddDialog = () => {
  showAddDialog.value = true
}

defineExpose({
  openAddDialog
})

onMounted(() => {
  void loadPhones()
})
</script>

<style scoped lang="scss">
.contact-phone-list {
  padding: 0;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem 0;
}

.list-title {
  font-size: 1rem;
  font-weight: 500;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  color: var(--q-negative);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
}

.empty-text {
  margin-top: 0.5rem;
  color: var(--q-grey-6);
  font-size: 0.9rem;
}

.phone-list {
  border: none;
}

.phone-item {
  padding: 0.5rem 0;
  min-height: auto;
  border-radius: 8px;
  margin: 0 -0.75rem;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

.phone-icon {
  cursor: pointer;
  
  &:hover {
    opacity: 0.7;
  }
}

.deleted-item {
  opacity: 0.6;
}

.phone-number {
  font-size: 0.95rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.phone-description {
  font-size: 0.85rem;
  margin-top: 0.125rem;
}
</style>
