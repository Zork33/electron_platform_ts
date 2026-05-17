export type ConfirmCodeReasonCode = 'LOGIN' | 'REGISTRATION'

export interface ConfirmCodeSettings {
  reason_code: ConfirmCodeReasonCode
  confirm_code_length: number
  confirm_code_alphabet: string
  confirm_code_ttl_minutes: number
  sending_max_attempts_count: number
  verification_max_attempts_count: number
  sending_subject: string
}

const DEFAULTS: Record<ConfirmCodeReasonCode, ConfirmCodeSettings> = {
  LOGIN: {
    reason_code: 'LOGIN',
    confirm_code_length: 6,
    confirm_code_alphabet: '0123456789',
    confirm_code_ttl_minutes: 10,
    sending_max_attempts_count: 3,
    verification_max_attempts_count: 5,
    sending_subject: 'Login confirmation code',
  },
  REGISTRATION: {
    reason_code: 'REGISTRATION',
    confirm_code_length: 6,
    confirm_code_alphabet: '0123456789',
    confirm_code_ttl_minutes: 10,
    sending_max_attempts_count: 3,
    verification_max_attempts_count: 5,
    sending_subject: 'Registration confirmation code',
  },
}

export interface ConfirmCodeSettingsOverrides {
  login?: Partial<ConfirmCodeSettings>
  registration?: Partial<ConfirmCodeSettings>
}

export class ConfirmCodeSettingsService {
  private readonly settings: Record<ConfirmCodeReasonCode, ConfirmCodeSettings>

  constructor(overrides: ConfirmCodeSettingsOverrides = {}) {
    this.settings = {
      LOGIN: { ...DEFAULTS.LOGIN, ...overrides.login, reason_code: 'LOGIN' },
      REGISTRATION: { ...DEFAULTS.REGISTRATION, ...overrides.registration, reason_code: 'REGISTRATION' },
    }
  }

  getByReasonCode(reasonCode: ConfirmCodeReasonCode): ConfirmCodeSettings {
    return this.settings[reasonCode]
  }
}
