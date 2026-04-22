<template>
  <div class="contact-email-list">
    <div class="list-header">
      <div class="list-title">Email</div>
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
      <q-btn flat dense label="Повторить" @click="loadEmails" />
    </div>

    <div v-else-if="!loading && displayedEmails.length === 0" class="empty-state">
      <q-icon name="email" size="32px" color="grey-5" />
      <div class="empty-text">Нет email адресов</div>
    </div>

    <q-list v-else class="email-list">
      <q-item 
        v-for="item in displayedEmails" 
        :key="item.contactInfo.id" 
        clickable
        class="email-item"
        :class="{ 'deleted-item': !!item.contactInfo.deleted_at }"
        @click="handleEditItem(item)"
      >
        <q-item-section avatar class="email-icon" @click.stop="handleEmailClick">
          <q-icon name="email" :color="item.contactInfo.deleted_at ? 'grey' : 'primary'" size="20px" style="cursor: pointer" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="email-address">
            {{ item.email.address }}
            <q-badge v-if="item.contactInfo.is_primary" color="primary" label="Основной" class="q-ml-sm" />
            <q-badge v-if="item.contactInfo.deleted_at" color="grey" label="Удалён" class="q-ml-sm" />
          </q-item-label>
          <q-item-label v-if="item.contactInfo.description" caption class="email-description">
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

    <ContactEmailDialog
      ref="addDialogRef"
      v-model="showAddDialog"
      title="Добавить email"
      @save="handleSaveEmail"
    />

    <ContactEmailDialog
      ref="editDialogRef"
      v-model="showEditDialog"
      title="Редактировать email"
      :initial-data="editingEmail"
      @save="handleUpdateEmail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { contactInfoApi, emailApi } from '@/shared/api'
import type { ContactInfo, Email } from '@/shared/api'
import ContactEmailDialog from './ContactEmailDialog.vue'

interface EmailItem {
  contactInfo: ContactInfo
  email: Email
}

interface EmailFormData {
  address: string
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
const emails = ref<Email[]>([])
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleted = ref(false)
const editingEmail = ref<EmailFormData | null>(null)
const editingItem = ref<EmailItem | null>(null)
const addDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)
const editDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)

const emailItems = computed<EmailItem[]>(() => {
  return contactInfos.value
    .filter((ci: ContactInfo) => ci.email_id !== null)
    .map((ci: ContactInfo) => {
      const email = emails.value.find((e: Email) => e.id === ci.email_id)
      return email ? { contactInfo: ci, email } : null
    })
    .filter((item): item is EmailItem => item !== null)
})

const displayedEmails = computed<EmailItem[]>(() => {
  if (showDeleted.value) {
    return emailItems.value
  }
  return emailItems.value.filter((item: EmailItem) => !item.contactInfo.deleted_at)
})

const loadEmails = async () => {
  loading.value = true
  error.value = null
  try {
    const allContactInfos = await contactInfoApi.list()
    contactInfos.value = allContactInfos.filter((ci: ContactInfo) => 
      props.personId && ci.person_id === props.personId
    )
    
    const emailIds = contactInfos.value
      .map((ci: ContactInfo) => ci.email_id)
      .filter((id): id is number => id !== null)
    
    if (emailIds.length > 0) {
      emails.value = await emailApi.list()
      emails.value = emails.value.filter((e: Email) => emailIds.includes(e.id))
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при загрузке email'
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  showAddDialog.value = true
}

const handleEditItem = (item: EmailItem) => {
  editingItem.value = item
  editingEmail.value = {
    address: item.email.address,
    description: item.contactInfo.description || '',
    is_primary: item.contactInfo.is_primary
  }
  showEditDialog.value = true
}

const handleSaveEmail = async (data: EmailFormData) => {
  if (!addDialogRef.value) return
  
  addDialogRef.value.setSaving(true)
  try {
    const email = await emailApi.create({
      address: data.address
    })

    await contactInfoApi.create({
      person_id: props.personId || null,
      email_id: email.id,
      description: data.description || null,
      is_primary: data.is_primary
    })

    $q.notify({ type: 'positive', message: 'Email успешно добавлен' })
    addDialogRef.value.close()
    await loadEmails()
    emit('update')
  } catch (err) {
    $q.notify({ 
      type: 'negative', 
      message: err instanceof Error ? err.message : 'Ошибка при добавлении email' 
    })
  } finally {
    addDialogRef.value.setSaving(false)
  }
}

const handleUpdateEmail = async (data: EmailFormData) => {
  if (!editDialogRef.value || !editingItem.value) return
  
  editDialogRef.value.setSaving(true)
  try {
    await emailApi.update(editingItem.value.email.id, {
      address: data.address
    })

    await contactInfoApi.update(editingItem.value.contactInfo.id, {
      description: data.description || null,
      is_primary: data.is_primary
    })

    $q.notify({ type: 'positive', message: 'Email успешно обновлён' })
    editDialogRef.value.close()
    await loadEmails()
    emit('update')
  } catch (err) {
    $q.notify({ 
      type: 'negative', 
      message: err instanceof Error ? err.message : 'Ошибка при обновлении email' 
    })
  } finally {
    editDialogRef.value.setSaving(false)
  }
}

const handleDelete = (item: EmailItem) => {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Удалить email ${item.email.address}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await contactInfoApi.deleteById(item.contactInfo.id)
        $q.notify({ type: 'positive', message: 'Email успешно удалён' })
        await loadEmails()
        emit('update')
      } catch {
        $q.notify({ type: 'negative', message: 'Ошибка при удалении' })
      }
    })()
  })
}

const handleRestore = async (item: EmailItem) => {
  try {
    await contactInfoApi.update(item.contactInfo.id, {
      deleted_at: null
    })
    $q.notify({ type: 'positive', message: 'Email успешно восстановлен' })
    await loadEmails()
    emit('update')
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка при восстановлении' })
  }
}

const handleEmailClick = () => {
  $q.notify({ type: 'info', message: 'Нет настроенных действий для email' })
}

const openAddDialog = () => {
  showAddDialog.value = true
}

defineExpose({
  openAddDialog
})

onMounted(() => {
  void loadEmails()
})
</script>

<style scoped lang="scss">
.contact-email-list {
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

.email-list {
  border: none;
}

.email-item {
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

.email-icon {
  cursor: pointer;
  
  &:hover {
    opacity: 0.7;
  }
}

.deleted-item {
  opacity: 0.6;
}

.email-address {
  font-size: 0.95rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.email-description {
  font-size: 0.85rem;
  margin-top: 0.125rem;
}
</style>
