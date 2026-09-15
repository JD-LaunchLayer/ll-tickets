import { createClient } from "@/lib/supabase/server";
import { filterTickets } from "@/lib/tickets/filters";
import type {
  Customer,
  Device,
  ListView,
  TicketDetail,
  TicketListItem,
  TicketNote,
} from "@/lib/tickets/types";

const TICKET_LIST_SELECT =
  "id, customer_id, device_id, symptom, status, waiting, arrival_kind, due_at, created_by, created_at, updated_at, customer:customers(id, name, phone, email), device:devices(id, customer_id, label, serial)";

function asCustomer(value: unknown): Customer | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Customer;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  return row;
}

function asDevice(value: unknown): Device | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Device;
  if (typeof row.id !== "string" || typeof row.label !== "string") return null;
  return row;
}

export async function listTickets(view: ListView): Promise<TicketListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(TICKET_LIST_SELECT)
    .order("due_at", { ascending: true });

  if (error) throw new Error(error.message);

  const tickets: TicketListItem[] = (data ?? []).map((row) => ({
    ...row,
    customer: asCustomer(row.customer),
    device: asDevice(row.device),
  }));

  return filterTickets(tickets, view);
}

export async function getTicketDetail(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(TICKET_LIST_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: notes, error: notesError } = await supabase
    .from("ticket_notes")
    .select("id, ticket_id, kind, body, created_by, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: false });

  if (notesError) throw new Error(notesError.message);

  return {
    ...data,
    customer: asCustomer(data.customer),
    device: asDevice(data.device),
    notes: (notes ?? []) as TicketNote[],
  };
}

export async function listRecentNotes(limit = 30): Promise<
  (TicketNote & { ticket_id: string; customer_name: string | null })[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_notes")
    .select(
      "id, ticket_id, kind, body, created_by, created_at, ticket:tickets(customer:customers(name))",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const ticket = row.ticket as { customer?: { name?: string } | null } | null;
    return {
      id: row.id,
      ticket_id: row.ticket_id,
      kind: row.kind,
      body: row.body,
      created_by: row.created_by,
      created_at: row.created_at,
      customer_name: ticket?.customer?.name ?? null,
    };
  });
}

