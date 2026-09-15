export const TICKET_STATUSES = ["intake", "diagnose", "parts", "done"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const BENCH_STATES = ["open", "waiting", "done"] as const;
export type BenchState = (typeof BENCH_STATES)[number];

export const ARRIVAL_KINDS = ["walk_in", "appointment"] as const;
export type ArrivalKind = (typeof ARRIVAL_KINDS)[number];

export const LIST_VIEWS = BENCH_STATES;
export type ListView = BenchState;

export const NOTE_KINDS = ["note", "finding", "check_outcome", "status"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

export type Device = {
  id: string;
  customer_id: string;
  label: string;
  serial: string | null;
};

export type Ticket = {
  id: string;
  customer_id: string;
  device_id: string;
  symptom: string;
  status: TicketStatus;
  waiting: boolean;
  arrival_kind: ArrivalKind;
  due_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketNote = {
  id: string;
  ticket_id: string;
  kind: NoteKind;
  body: string;
  created_by: string | null;
  created_at: string;
};

export type TicketListItem = Ticket & {
  customer: Customer | null;
  device: Device | null;
};

export type TicketDetail = TicketListItem & {
  notes: TicketNote[];
};

export function isListView(value: string | undefined | null): value is ListView {
  return LIST_VIEWS.includes(value as ListView);
}

export function isTicketStatus(value: string): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus);
}

export function isArrivalKind(value: string): value is ArrivalKind {
  return ARRIVAL_KINDS.includes(value as ArrivalKind);
}

export function isNoteKind(value: string): value is NoteKind {
  return NOTE_KINDS.includes(value as NoteKind);
}
