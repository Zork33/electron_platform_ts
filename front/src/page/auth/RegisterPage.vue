<template>
  <div class="register-container" @click="clearErrors">
    <div class="logo-section">
      <img src="~assets/logo.png" alt="Logo" class="logo-image" />
    </div>

    <div class="text-center q-mb-md">
      <div class="auth-title">Регистрация</div>

      <!-- Step indicator -->
      <div class="step-indicator">
        <div class="step-dot" :class="{ active: step === 1 }">1</div>
        <div class="step-line"></div>
        <div class="step-dot" :class="{ active: step === 2 }">2</div>
      </div>
    </div>

    <!-- Шаг 1: Ввод данных -->
    <q-slide-transition>
      <div v-if="step === 1" class="register-step">
        <q-form @submit="onDataSubmit" class="register-form">
        <q-input
          v-model="formData.auth_email"
          label="Email *"
          type="text"
          outlined
          color="secondary"
          :error="!!fieldErrors.auth_email"
          :error-message="fieldErrors.auth_email"
          no-error-icon
          hide-bottom-space
          class="auth-input email-input"
          @update:model-value="clearErrors"
        />

        <q-input
          v-model="formData.first_name"
          label="Имя *"
          outlined
          color="secondary"
          :error="!!fieldErrors.first_name"
          :error-message="fieldErrors.first_name"
          no-error-icon
          hide-bottom-space
          class="auth-input first-name-input"
          @update:model-value="clearErrors"
        />

        <q-input
          v-model="formData.last_name"
          label="Фамилия"
          outlined
          color="secondary"
          hide-bottom-space
          class="auth-input"
          @update:model-value="clearErrors"
        />

        <q-input
          v-model="formData.middle_name"
          label="Отчество"
          outlined
          color="secondary"
          hide-bottom-space
          class="auth-input"
          @update:model-value="clearErrors"
        />

        <q-btn
          type="submit"
          color="secondary"
          size="lg"
          :loading="isLoading"
          :disable="isLoading"
          class="register-submit-button"
        >
          <template v-slot:default>
            Отправить код<br>подтверждения
          </template>
          <template v-slot:loading>
            <q-spinner-gears color="white" />
          </template>
        </q-btn>
      </q-form>
    </div>
    </q-slide-transition>

    <!-- Шаг 2: Ввод кода подтверждения -->
    <q-slide-transition>
      <div v-if="step === 2" class="register-step">
      <div class="text-center q-mb-lg">
        <q-icon name="mark_email_read" size="48px" color="positive" class="q-mb-md" />
        <p class="text-body1">
          Код подтверждения отправлен на<br>
          <strong>{{ formData.auth_email }}</strong>
        </p>
      </div>

      <q-form @submit.prevent="onCodeSubmit" class="register-code-form">
          <q-input
            v-model="confirmCode"
            label="Код подтверждения"
            outlined
            color="secondary"
            mask="######"
            hide-bottom-space
            input-class="text-center"
            input-style="font-size: 1.5rem; letter-spacing: 0.5rem; text-align: center;"
          />

          <q-btn
            type="submit"
            color="secondary"
            size="lg"
            :loading="isLoading"
            :disable="!confirmCode || confirmCode.length !== 6 || isLoading"
            label="Зарегистрироваться"
            class="q-mt-md"
          >
            <template v-slot:loading>
              <q-spinner-gears color="white" />
            </template>
          </q-btn>
      </q-form>

      <!-- Повторная отправка кода -->
      <div class="text-center q-mt-lg">
        <p class="text-body2 text-grey-7">
          Не получили код?
          <q-btn
            flat
            no-caps
            color="secondary"
            label="Отправить повторно"
            @click="resendCode"
            :disable="isLoading"
            class="q-ml-xs"
          />
        </p>
      </div>
    </div>
    </q-slide-transition>

    <div class="text-center q-mt-sm">
      <p class="text-body2">
        Уже есть аккаунт?
        <router-link to="/auth/login" class="text-secondary text-decoration-none">
          Войти
        </router-link>
      </p>
      <div class="q-mt-sm">
        <q-btn
          flat
          round
          icon="arrow_back"
          color="grey-7"
          no-caps
          @click="goToAuthSelect"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../shared/composable'
import type { RegisterStartRequest } from '../../shared/composable'

const router = useRouter()
const { startRegister, finishRegister, isLoading } = useAuth()

const step = ref(1)

const goToAuthSelect = () => {
  router.push('/auth').catch(() => {})
}
const confirmCode = ref('')

const formData = reactive<RegisterStartRequest>({
  auth_email: '',
  first_name: '',
  last_name: '',
  middle_name: ''
})

const fieldErrors = reactive({
  auth_email: '',
  first_name: ''
})

function clearErrors() {
  fieldErrors.auth_email = ''
  fieldErrors.first_name = ''
}

function validateStep1(): boolean {
  fieldErrors.auth_email = ''
  fieldErrors.first_name = ''
  let ok = true

  const email = formData.auth_email?.trim() ?? ''
  if (!email) {
    fieldErrors.auth_email = 'Email обязателен'
    ok = false
  } else if (!/.+@.+\..+/.test(email)) {
    fieldErrors.auth_email = 'Некорректный формат email'
    ok = false
  }

  const firstName = formData.first_name?.trim() ?? ''
  if (!firstName) {
    fieldErrors.first_name = 'Поле обязательно для заполнения'
    ok = false
  }

  return ok
}

const onDataSubmit = async () => {
  if (!validateStep1()) {
    return
  }
  try {
    await startRegister(formData)
    step.value = 2
  } catch {
    // Ошибка уже обработана в useAuth
  }
}

const onCodeSubmit = async () => {
  try {
    await finishRegister(confirmCode.value)
    // Перенаправление произойдет автоматически в useAuth
  } catch (error) {
    // Ошибка уже обработана в useAuth
    console.error('Registration error:', error)
    confirmCode.value = ''
  }
}

const resendCode = async () => {
  try {
    await startRegister(formData)
  } catch {
    // Ошибка уже обработана в useAuth
  }
}
</script>

<style lang="scss" scoped>
.register-container {
  width: 480px;
  max-width: 100%;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-section {
  text-align: center;
}

.logo-image {
  height: 160px;
  object-fit: contain;
  border-radius: 16px;
  margin-bottom: -0.5rem;
}

.auth-title {
  margin: 0 0 0.5rem 0;
  font-weight: 300;
  font-size: 2.5rem;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 1rem 0;
  gap: 0.5rem;
}

.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.7);
  transition: all 0.3s ease;

  // Dark mode override
  .body--dark & {
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
  }

  &.active {
    background: var(--q-secondary);
    border-color: var(--q-secondary);
    color: white;
    box-shadow: 0 0 0 3px rgba(var(--q-secondary-rgb), 0.3);
  }
}

.step-line {
  width: 40px;
  height: 2px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1px;

  // Dark mode override
  .body--dark & {
    background: rgba(255, 255, 255, 0.3);
  }
}

.auth-subtitle {
  color: #666;
  font-size: 0.9rem;
}

.register-step {
  margin-bottom: 1rem;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem 1.5rem 1.5rem 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
}

.register-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  :deep(.q-field) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
}

.auth-input {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;

  :deep(.q-field) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  :deep(.q-field__control) {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  :deep(.q-field__messages) {
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }
}

.register-submit-button {
  width: 100%;
  text-transform: none;
  font-weight: 500;
  border-radius: 50px !important;
  margin-top: .5rem;
  line-height: 1.3;
}

.register-code-form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.register-code-form {
  .q-btn {
    width: 100%;
  }
}

.q-btn {
  text-transform: none;
  font-weight: 500;
  border-radius: 50px !important;
}

@media (max-width: 600px) {
  .register-container {
    padding: 1rem;
  }

  .logo-image {
    width: 90px;
    height: 90px;
  }

  .step-indicator {
    gap: 0.25rem;
  }

  .step-line {
    width: 30px;
  }
}
</style>
