import { authUserSchema, loginSchema } from './auth.schemas';

describe('loginSchema', () => {
  it('accepts a valid email/password payload', () => {
    const result = loginSchema.safeParse({ email: 'admin@lavenet.ci', password: 'Demo1234!' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'Demo1234!' });
    expect(result.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = loginSchema.safeParse({ email: 'admin@lavenet.ci', password: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('authUserSchema', () => {
  it('accepts a user with a null email', () => {
    const result = authUserSchema.safeParse({
      id: 'usr_1',
      email: null,
      phone: '+2250700000001',
      role: 'CLIENT',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const result = authUserSchema.safeParse({
      id: 'usr_1',
      email: null,
      phone: '+2250700000001',
      role: 'SUPERUSER',
    });
    expect(result.success).toBe(false);
  });
});
