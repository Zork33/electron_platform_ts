<template>
  <q-dialog v-model="isOpen" persistent>
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">{{ title }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-form ref="formRef" @submit="handleSubmit">
          <q-input
            v-model="formData.full_number"
            label="Телефон"
            filled
            mask="+# (###) ###-##-##"
            placeholder="+7 (___) ___-__-__"
            :rules="[(v) => !!v || 'Обязательное поле']"
          >
            <template #prepend>
              <q-icon name="phone" />
            </template>
          </q-input>

          <q-input
            v-model="formData.description"
            label="Описание"
            filled
            placeholder="Например: Рабочий, Личный, Домашний"
            class="q-mt-md"
          />

          <q-checkbox
            v-model="formData.is_primary"
            label="Основной телефон"
            class="q-mt-md"
          />
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Отмена" color="grey" @click="handleCancel" />
        <q-btn
          flat
          label="Сохранить"
          color="primary"
          :loading="saving"
          @click="() => formRef?.submit()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'

interface PhoneFormData {
  full_number: string
  description: string
  is_primary: boolean
}

const props = defineProps<{
  modelValue: boolean
  title?: string
  initialData?: PhoneFormData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [data: PhoneFormData]
}>()

const isOpen = ref(props.modelValue)
const saving = ref(false)
const formRef = ref<{ submit: () => void } | null>(null)

const formData = reactive<PhoneFormData>({
  full_number: '',
  description: '',
  is_primary: false
})

watch(() => props.modelValue, (val) => {
  isOpen.value = val
  if (val) {
    if (props.initialData) {
      formData.full_number = props.initialData.full_number
      formData.description = props.initialData.description
      formData.is_primary = props.initialData.is_primary
    } else {
      formData.full_number = ''
      formData.description = ''
      formData.is_primary = false
    }
  }
})

watch(isOpen, (val) => {
  emit('update:modelValue', val)
})

const handleSubmit = () => {
  emit('save', { ...formData })
}

const handleCancel = () => {
  isOpen.value = false
}

defineExpose({
  setSaving: (value: boolean) => {
    saving.value = value
  },
  close: () => {
    isOpen.value = false
  }
})
</script>
