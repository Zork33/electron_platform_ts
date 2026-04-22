<template>
  <div class="contact-manager">
    <!-- Кнопка добавления контакта -->
    <div class="add-contact-section">
      <q-btn
        flat
        label="Добавить контакт"
        color="primary"
      >
        <q-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="openAddDialog('phone')">
              <q-item-section avatar>
                <q-icon name="phone" color="primary" />
              </q-item-section>
              <q-item-section>Телефон</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="openAddDialog('email')">
              <q-item-section avatar>
                <q-icon name="email" color="primary" />
              </q-item-section>
              <q-item-section>Email</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="openAddDialog('telegram')">
              <q-item-section avatar>
                <q-icon name="telegram" color="primary" />
              </q-item-section>
              <q-item-section>Telegram</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="openAddDialog('weblink')">
              <q-item-section avatar>
                <q-icon name="link" color="primary" />
              </q-item-section>
              <q-item-section>Веб-ссылка</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <!-- Список телефонов (всегда рендерится для доступа к ref) -->
    <div v-show="hasPhones" class="contact-section">
      <ContactPhoneList 
        ref="phoneListRef"
        :person-id="personId" 
        @update="handleUpdate"
      />
    </div>

    <!-- Список email (всегда рендерится для доступа к ref) -->
    <div v-show="hasEmails" class="contact-section">
      <ContactEmailList 
        ref="emailListRef"
        :person-id="personId" 
        @update="handleUpdate"
      />
    </div>

    <!-- Список Telegram (всегда рендерится для доступа к ref) -->
    <div v-show="hasTelegrams" class="contact-section">
      <ContactTelegramList 
        ref="telegramListRef"
        :person-id="personId" 
        @update="handleUpdate"
      />
    </div>

    <!-- Список веб-ссылок (всегда рендерится для доступа к ref) -->
    <div v-show="hasWebLinks" class="contact-section">
      <ContactWebLinkList 
        ref="weblinkListRef"
        :person-id="personId" 
        @update="handleUpdate"
      />
    </div>

    <!-- Пустое состояние -->
    <div v-if="!loading && !hasAnyContacts" class="empty-state">
      <q-icon name="contacts" size="48px" color="grey-5" />
      <div class="empty-text">Нет контактов</div>
      <div class="empty-hint">Нажмите "Добавить контакт" чтобы начать</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { contactInfoApi } from '@/shared/api'
import type { ContactInfo } from '@/shared/api'
import ContactPhoneList from './ContactPhoneList.vue'
import ContactEmailList from './ContactEmailList.vue'
import ContactTelegramList from './ContactTelegramList.vue'
import ContactWebLinkList from './ContactWebLinkList.vue'

const props = defineProps<{
  personId?: number | undefined
}>()

const loading = ref(false)
const contactInfos = ref<ContactInfo[]>([])

const phoneListRef = ref<{ openAddDialog: () => void } | null>(null)
const emailListRef = ref<{ openAddDialog: () => void } | null>(null)
const telegramListRef = ref<{ openAddDialog: () => void } | null>(null)
const weblinkListRef = ref<{ openAddDialog: () => void } | null>(null)

const hasPhones = computed(() => 
  contactInfos.value.some(ci => ci.phone_number_id !== null && !ci.deleted_at)
)

const hasEmails = computed(() => 
  contactInfos.value.some(ci => ci.email_id !== null && !ci.deleted_at)
)

const hasTelegrams = computed(() => 
  contactInfos.value.some(ci => ci.tg_acc_id !== null && !ci.deleted_at)
)

const hasWebLinks = computed(() => 
  contactInfos.value.some(ci => ci.web_link_id !== null && !ci.deleted_at)
)

const hasAnyContacts = computed(() => 
  hasPhones.value || hasEmails.value || hasTelegrams.value || hasWebLinks.value
)

const loadContacts = async () => {
  loading.value = true
  try {
    const allContactInfos = await contactInfoApi.list()
    contactInfos.value = allContactInfos.filter((ci: ContactInfo) => 
      props.personId && ci.person_id === props.personId
    )
  } catch (err) {
    console.error('Ошибка при загрузке контактов:', err)
  } finally {
    loading.value = false
  }
}

const openAddDialog = (type: 'phone' | 'email' | 'telegram' | 'weblink') => {
  switch (type) {
    case 'phone':
      phoneListRef.value?.openAddDialog()
      break
    case 'email':
      emailListRef.value?.openAddDialog()
      break
    case 'telegram':
      telegramListRef.value?.openAddDialog()
      break
    case 'weblink':
      weblinkListRef.value?.openAddDialog()
      break
  }
}

const handleUpdate = () => {
  void loadContacts()
}

onMounted(() => {
  void loadContacts()
})
</script>

<style scoped lang="scss">
.contact-manager {
  max-width: 720px;
}

.add-contact-section {
  margin-bottom: 1.5rem;
}

.contact-section {
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-text {
  margin-top: 1rem;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--q-grey-7);
}

.empty-hint {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: var(--q-grey-6);
}
</style>
