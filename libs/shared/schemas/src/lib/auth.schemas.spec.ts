import {
  authUserSchema,
  changeEmailSchema,
  changePasswordSchema,
  changePhoneSchema,
  loginSchema,
  normalizeCiPhone,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from './auth.schemas';

describe('loginSchema', () => {
  it('accepts an email identifier', () => {
    const result = loginSchema.safeParse({
      identifier: 'admin@lavenet.ci',
      password: 'Demo1234!',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a phone identifier in E.164 format', () => {
    const result = loginSchema.safeParse({
      identifier: '+2250700000001',
      password: 'Demo1234!',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a local-format phone identifier and normalizes it to +225 (F-AUTH-05 bug report)', () => {
    const result = loginSchema.safeParse({ identifier: '0700070007', password: 'Demo1234!' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identifier).toBe('+2250700070007');
    }
  });

  it('rejects an identifier that is neither a valid email nor a valid phone, in French', () => {
    const result = loginSchema.safeParse({
      identifier: 'not-an-identifier',
      password: 'Demo1234!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Identifiant invalide. Saisissez un email ou un numéro de téléphone.',
      );
    }
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({ identifier: 'admin@lavenet.ci', password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  const VALID = {
    fullName: 'Aya Kouassi',
    phone: '+2250700000009',
    email: 'aya@example.com',
    password: 'Demo1234!',
  };

  it('accepts a full valid payload', () => {
    expect(registerSchema.safeParse(VALID).success).toBe(true);
  });

  it('accepts a payload without email -- phone alone is a valid account identity', () => {
    const withoutEmail = { ...VALID };
    Reflect.deleteProperty(withoutEmail, 'email');
    expect(registerSchema.safeParse(withoutEmail).success).toBe(true);
  });

  it('rejects a payload without a phone -- phone is always required', () => {
    const withoutPhone = { ...VALID };
    Reflect.deleteProperty(withoutPhone, 'phone');
    expect(registerSchema.safeParse(withoutPhone).success).toBe(false);
  });

  it('accepts a local-format phone (0700070007) and normalizes it to +225', () => {
    const result = registerSchema.safeParse({ ...VALID, phone: '0700070007' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+2250700070007');
    }
  });

  it('rejects a phone that is neither a local nor an international format', () => {
    const result = registerSchema.safeParse({ ...VALID, phone: '12345' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Numéro invalide. Format attendu : 07 00 07 00 07',
      );
    }
  });

  it('rejects a blank full name', () => {
    expect(registerSchema.safeParse({ ...VALID, fullName: '  ' }).success).toBe(false);
  });
});

describe('normalizeCiPhone', () => {
  const CANONICAL = '+2250700070007';

  it.each([
    ['0700070007', CANONICAL],
    ['07 00 07 00 07', CANONICAL],
    ['+2250700070007', CANONICAL],
    ['002250700070007', CANONICAL],
  ])('normalizes %s to the same canonical value', (input, expected) => {
    expect(normalizeCiPhone(input)).toBe(expected);
  });

  it('rejects a number that is really invalid', () => {
    expect(normalizeCiPhone('12345')).toBeNull();
    expect(normalizeCiPhone('not-a-phone')).toBeNull();
    expect(normalizeCiPhone('070007000')).toBeNull(); // 9 digits, one short
  });
});

describe('verifyOtpSchema', () => {
  it('accepts a 6-digit code', () => {
    expect(verifyOtpSchema.safeParse({ code: '123456' }).success).toBe(true);
  });

  it('rejects a code that is not exactly 6 digits', () => {
    expect(verifyOtpSchema.safeParse({ code: '12345' }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ code: '1234567' }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ code: 'abcdef' }).success).toBe(false);
  });
});

describe('passwordResetRequestSchema', () => {
  it('accepts an email or a phone identifier, same as login', () => {
    expect(passwordResetRequestSchema.safeParse({ identifier: 'a@b.com' }).success).toBe(true);
    expect(passwordResetRequestSchema.safeParse({ identifier: '+2250700000001' }).success).toBe(
      true,
    );
  });

  it('rejects an identifier that is neither', () => {
    expect(passwordResetRequestSchema.safeParse({ identifier: 'nope' }).success).toBe(false);
  });
});

describe('passwordResetConfirmSchema', () => {
  const VALID = { identifier: 'a@b.com', code: '123456', newPassword: 'Demo1234!' };

  it('accepts a full valid payload', () => {
    expect(passwordResetConfirmSchema.safeParse(VALID).success).toBe(true);
  });

  it('rejects a code that is not exactly 6 digits', () => {
    expect(passwordResetConfirmSchema.safeParse({ ...VALID, code: '123' }).success).toBe(false);
  });

  it('rejects a new password shorter than 8 characters', () => {
    expect(passwordResetConfirmSchema.safeParse({ ...VALID, newPassword: 'short' }).success).toBe(
      false,
    );
  });
});

describe('updateProfileSchema', () => {
  it('accepts an empty payload -- every field is optional', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial payload', () => {
    expect(updateProfileSchema.safeParse({ notifySms: false }).success).toBe(true);
  });

  it('rejects a blank full name', () => {
    expect(updateProfileSchema.safeParse({ fullName: '  ' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('requires both the current and the new password', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'Demo1234!', newPassword: 'New12345!' })
        .success,
    ).toBe(true);
    expect(changePasswordSchema.safeParse({ newPassword: 'New12345!' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'Demo1234!' }).success).toBe(false);
  });
});

describe('changePhoneSchema', () => {
  it('requires the current password and accepts either phone format', () => {
    expect(
      changePhoneSchema.safeParse({ currentPassword: 'Demo1234!', newPhone: '+2250700000009' })
        .success,
    ).toBe(true);
    expect(
      changePhoneSchema.safeParse({ currentPassword: 'Demo1234!', newPhone: '0700000009' }).success,
    ).toBe(true);
  });

  it('normalizes a local-format newPhone to +225', () => {
    const result = changePhoneSchema.safeParse({
      currentPassword: 'Demo1234!',
      newPhone: '0700070007',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newPhone).toBe('+2250700070007');
    }
  });

  it('rejects a newPhone that is really invalid, with the French message', () => {
    const result = changePhoneSchema.safeParse({
      currentPassword: 'Demo1234!',
      newPhone: 'abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Numéro invalide. Format attendu : 07 00 07 00 07',
      );
    }
  });
});

describe('changeEmailSchema', () => {
  it('requires the current password and a valid email', () => {
    expect(
      changeEmailSchema.safeParse({ currentPassword: 'Demo1234!', newEmail: 'a@b.com' }).success,
    ).toBe(true);
    expect(
      changeEmailSchema.safeParse({ currentPassword: 'Demo1234!', newEmail: 'not-an-email' })
        .success,
    ).toBe(false);
  });
});

describe('authUserSchema', () => {
  it('accepts a user with a null email and null full name', () => {
    const result = authUserSchema.safeParse({
      id: 'usr_1',
      fullName: null,
      email: null,
      phone: '+2250700000001',
      phoneVerified: true,
      notifyEmail: true,
      notifySms: true,
      role: 'CLIENT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const result = authUserSchema.safeParse({
      id: 'usr_1',
      fullName: null,
      email: null,
      phone: '+2250700000001',
      phoneVerified: true,
      role: 'SUPERUSER',
    });
    expect(result.success).toBe(false);
  });
});
