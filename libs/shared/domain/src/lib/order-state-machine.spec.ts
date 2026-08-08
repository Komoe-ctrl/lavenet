import { describe, expect, it } from 'vitest';
import {
  canTransition,
  ORDER_PROGRESS_STEPS,
  ORDER_STATUS_LABELS_FR,
  type OrderStatus,
  orderProgressStepIndex,
  requiresReason,
} from './order-state-machine';

const ALL_STATUSES: OrderStatus[] = [
  'DRAFT',
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'ON_HOLD',
];

// CLAUDE.md §7: "machine à états (matrice complète des transitions valides
// et invalides)" -- every (from, to) pair, not just the happy-path ones.
const VALID_PAIRS = new Set([
  'DRAFT->PENDING_PICKUP',
  'DRAFT->CANCELLED',
  'PENDING_PICKUP->PICKED_UP',
  'PENDING_PICKUP->CANCELLED',
  'PICKED_UP->PROCESSING',
  'PROCESSING->READY',
  'PROCESSING->ON_HOLD',
  'READY->OUT_FOR_DELIVERY',
  'READY->ON_HOLD',
  'ON_HOLD->PROCESSING',
  'ON_HOLD->READY',
  'OUT_FOR_DELIVERY->DELIVERED',
]);

describe('canTransition — full matrix', () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const expected = VALID_PAIRS.has(`${from}->${to}`);
      it(`${from} -> ${to} is ${expected ? 'allowed' : 'refused'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }

  it('every status has no self-transition', () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('DELIVERED and CANCELLED are terminal (no outgoing transition at all)', () => {
    for (const to of ALL_STATUSES) {
      expect(canTransition('DELIVERED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });
});

describe('requiresReason', () => {
  it('requires a reason only for ON_HOLD', () => {
    for (const to of ALL_STATUSES) {
      expect(requiresReason(to)).toBe(to === 'ON_HOLD');
    }
  });
});

describe('ORDER_STATUS_LABELS_FR', () => {
  it('has a French label for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(ORDER_STATUS_LABELS_FR[status]).toBeTruthy();
    }
  });

  it('matches the exact wording from the cahier des charges', () => {
    expect(ORDER_STATUS_LABELS_FR.PENDING_PICKUP).toBe("En attente d'enlèvement");
    expect(ORDER_STATUS_LABELS_FR.PICKED_UP).toBe('Récupéré');
    expect(ORDER_STATUS_LABELS_FR.PROCESSING).toBe('En traitement');
    expect(ORDER_STATUS_LABELS_FR.READY).toBe('Prêt');
    expect(ORDER_STATUS_LABELS_FR.OUT_FOR_DELIVERY).toBe('En livraison');
    expect(ORDER_STATUS_LABELS_FR.DELIVERED).toBe('Livré');
    expect(ORDER_STATUS_LABELS_FR.CANCELLED).toBe('Annulé');
    expect(ORDER_STATUS_LABELS_FR.ON_HOLD).toBe('Suspendu');
  });
});

describe('orderProgressStepIndex', () => {
  it('orders the happy path from pending pickup to delivered', () => {
    expect(ORDER_PROGRESS_STEPS).toEqual([
      'PENDING_PICKUP',
      'PICKED_UP',
      'PROCESSING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
    ]);
  });

  it('returns the position for a happy-path status', () => {
    expect(orderProgressStepIndex('PENDING_PICKUP')).toBe(0);
    expect(orderProgressStepIndex('DELIVERED')).toBe(5);
  });

  it('returns -1 for a status outside the happy path', () => {
    expect(orderProgressStepIndex('DRAFT')).toBe(-1);
    expect(orderProgressStepIndex('CANCELLED')).toBe(-1);
    expect(orderProgressStepIndex('ON_HOLD')).toBe(-1);
  });
});
