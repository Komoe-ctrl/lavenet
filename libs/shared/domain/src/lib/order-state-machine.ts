// F-STA-01. The single source of truth for which transitions are legal --
// used by the API (authority) and by the web (which actions to display).
// CLAUDE.md §4 rule 3: pure, exhaustively tested, no history/context beyond
// the current status. Matches CAHIER-DES-CHARGES.md §5.4's diagram exactly.
export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PICKUP'
  | 'PICKED_UP'
  | 'PROCESSING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ON_HOLD';

// ON_HOLD is reachable from, and returns to, either PROCESSING or READY
// (cahier: "ON_HOLD <-> (PROCESSING | READY)") -- canTransition is a pure
// (from, to) graph with no memory of which of the two it came from, so
// both return directions are valid regardless of origin.
const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  DRAFT: ['PENDING_PICKUP', 'CANCELLED'],
  PENDING_PICKUP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['PROCESSING'],
  PROCESSING: ['READY', 'ON_HOLD'],
  READY: ['OUT_FOR_DELIVERY', 'ON_HOLD'],
  ON_HOLD: ['PROCESSING', 'READY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

// F-STA-02: "motif éventuel" for every transition, but the cahier only
// makes it mandatory for ON_HOLD ("incident... Motif obligatoire").
// CANCELLED's reason stays optional -- ADR 0008 covers cancellation, which
// says nothing about requiring one.
export function requiresReason(to: OrderStatus): boolean {
  return to === 'ON_HOLD';
}

// F-STA-03, exact wording from CAHIER-DES-CHARGES.md §5.4. DRAFT is never
// shown to the client (it's the cart, not a placed order) -- included here
// only so the record stays total over OrderStatus.
export const ORDER_STATUS_LABELS_FR: Readonly<Record<OrderStatus, string>> = {
  DRAFT: 'Brouillon',
  PENDING_PICKUP: "En attente d'enlèvement",
  PICKED_UP: 'Récupéré',
  PROCESSING: 'En traitement',
  READY: 'Prêt',
  OUT_FOR_DELIVERY: 'En livraison',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
  ON_HOLD: 'Suspendu',
};

// F-STA-03's progression frise: the happy-path sequence only.
// CANCELLED/ON_HOLD interrupt it rather than occupying a step -- a caller
// rendering the frise shows them as a separate badge, not a position in
// this array (see orderProgressStepIndex).
export const ORDER_PROGRESS_STEPS: readonly OrderStatus[] = [
  'PENDING_PICKUP',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

// -1 for a status that isn't part of the happy path (DRAFT, CANCELLED,
// ON_HOLD) -- the caller decides how to render that case, this function
// only answers "where in the sequence, if anywhere".
export function orderProgressStepIndex(status: OrderStatus): number {
  return ORDER_PROGRESS_STEPS.indexOf(status);
}
