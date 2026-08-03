import { BadRequestException } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

// nestjs-zod's default ZodValidationPipe always sets the response's
// `message` to the literal string "Validation failed" -- the real reason
// only ever lands in a separate `errors` array the frontend never reads
// (extractErrorMessage, repeated across every auth page, reads `message`).
// Every schema field below has its own French, specific message (see
// auth.schemas.ts); this pipe is what actually gets one of them in front
// of the user instead of the English placeholder.
export const FrenchZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: unknown) => {
    const message =
      error instanceof ZodError
        ? (error.issues[0]?.message ?? 'Requête invalide.')
        : 'Requête invalide.';
    return new BadRequestException(message);
  },
});
