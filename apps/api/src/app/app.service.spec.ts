import { Test } from '@nestjs/testing';
import { describe, it, expect } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('returns a hello payload', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    const service = moduleRef.get(AppService);
    expect(service.getData()).toEqual({ message: 'Hello API' });
  });
});
