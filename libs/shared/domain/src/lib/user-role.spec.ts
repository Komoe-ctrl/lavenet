import { USER_ROLES } from './user-role';

describe('USER_ROLES', () => {
  it('matches the Prisma UserRole enum (prisma/schema.prisma)', () => {
    expect(USER_ROLES).toEqual(['CLIENT', 'STAFF', 'COURIER', 'ADMIN']);
  });
});
