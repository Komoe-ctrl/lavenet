import { authUserSchema, loginSchema, registerSchema, verifyOtpSchema } from './auth.schemas';

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

  it('rejects an identifier that is neither a valid email nor a valid phone', () => {
    const result = loginSchema.safeParse({
      identifier: 'not-an-identifier',
      password: 'Demo1234!',
    });
    expect(result.success).toBe(false);
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

  it('rejects a phone that is not E.164', () => {
    expect(registerSchema.safeParse({ ...VALID, phone: '0700000009' }).success).toBe(false);
  });

  it('rejects a blank full name', () => {
    expect(registerSchema.safeParse({ ...VALID, fullName: '  ' }).success).toBe(false);
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

describe('authUserSchema', () => {
  it('accepts a user with a null email and null full name', () => {
    const result = authUserSchema.safeParse({
      id: 'usr_1',
      fullName: null,
      email: null,
      phone: '+2250700000001',
      phoneVerified: true,
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
