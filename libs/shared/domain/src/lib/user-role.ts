// Single source of truth for the role enum — mirrors Prisma's `UserRole`
// (prisma/schema.prisma). Prisma's own enum type can't be imported here:
// this lib must stay dependency-free (importable from both apps/web and
// apps/api), and `@prisma/client` is API-only.
export const USER_ROLES = ['CLIENT', 'STAFF', 'COURIER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];
