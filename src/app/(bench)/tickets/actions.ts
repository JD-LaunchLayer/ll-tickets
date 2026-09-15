"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBenchSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dueAtForCreate, formatShopDateTime } from "@/lib/tickets/datetime";
import {
  advanceLabel,
  getDoNext,
  nextStatus,
  outcomeById,
  outcomeNoteBody,
} from "@/lib/tickets/do-next";
import { STATUS_LABELS } from "@/lib/tickets/labels";
import { findCustomerByPhone } from "@/lib/tickets/queries";
import {
  isArrivalKind,
  isNoteKind,
  isTicketStatus,
  type ArrivalKind,
  type NoteKind,
} from "@/lib/tickets/types";

function requiredText(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value ? value : null;
}

export async function createTicket(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();

  const customerName = requiredText(formData, "customer_name");
  const phone = optionalText(formData, "phone");
  const email = optionalText(formData, "email");
  const deviceLabel = requiredText(formData, "device_label");
  const serial = optionalText(formData, "serial");
  const symptom = requiredText(formData, "symptom");
  const arrivalRaw = String(formData.get("arrival_kind") ?? "walk_in");
  if (!isArrivalKind(arrivalRaw)) throw new Error("Choose here now or appointment.");
  const arrivalKind: ArrivalKind = arrivalRaw;
  const appointmentLocal = optionalText(formData, "appointment_at");

  const dueAt = dueAtForCreate(arrivalKind, appointmentLocal);

  let customerId: string;
  const existing = phone ? await findCustomerByPhone(phone) : null;
  if (existing) {
    customerId = existing.id;
    const { error } = await supabase
      .from("customers")
      .update({
        name: customerName,
        email: email ?? existing.email,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("customers")
      .insert({ name: customerName, phone, email })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not save customer.");
    customerId = data.id;
  }

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .insert({
      customer_id: customerId,
      label: deviceLabel,
      serial,
    })
    .select("id")
    .single();
  if (deviceError || !device) {
    throw new Error(deviceError?.message ?? "Could not save device.");
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      customer_id: customerId,
      device_id: device.id,
      symptom,
      status: "intake",
      waiting: false,
      arrival_kind: arrivalKind,
      due_at: dueAt.toISOString(),
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (ticketError || !ticket) {
    throw new Error(ticketError?.message ?? "Could not open ticket.");
  }

  const opened =
    arrivalKind === "walk_in"
      ? "Ticket opened — here now. Straight onto the bench."
      : `Ticket booked — appointment ${formatShopDateTime(dueAt)}.`;

  await supabase.from("ticket_notes").insert({
    ticket_id: ticket.id,
    kind: "status",
    body: opened,
    created_by: session.user.id,
  });

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function addTicketNote(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();
  const ticketId = requiredText(formData, "ticket_id");
  const body = requiredText(formData, "body");
  const kindRaw = String(formData.get("kind") ?? "note");
  const kind: NoteKind = isNoteKind(kindRaw) ? kindRaw : "note";

  const { error } = await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    kind,
    body,
    created_by: session.user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/more");
}

export async function applyDoNextOutcome(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();
  const ticketId = requiredText(formData, "ticket_id");
  const outcomeId = requiredText(formData, "outcome_id");

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, status, waiting")
    .eq("id", ticketId)
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Ticket not found.");

  const check = getDoNext(ticket);
  const outcome = outcomeById(check, outcomeId);
  if (!check || !outcome) throw new Error("That Do next action is no longer available.");

  const patch: {
    status?: typeof ticket.status;
    waiting?: boolean;
  } = {};
  if (outcome.status) patch.status = outcome.status;
  if (typeof outcome.waiting === "boolean") patch.waiting = outcome.waiting;
  if (outcome.status === "done") patch.waiting = false;

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase
      .from("tickets")
      .update(patch)
      .eq("id", ticketId);
    if (updateError) throw new Error(updateError.message);
  }

  const extra = optionalText(formData, "body");
  const body = extra
    ? `${outcomeNoteBody(check, outcome)} ${extra}`
    : outcomeNoteBody(check, outcome);

  const { error: noteError } = await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    kind: "check_outcome",
    body,
    created_by: session.user.id,
  });
  if (noteError) throw new Error(noteError.message);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/more");
}

export async function advanceTicketStatus(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();
  const ticketId = requiredText(formData, "ticket_id");

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, status")
    .eq("id", ticketId)
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Ticket not found.");
  if (!isTicketStatus(ticket.status)) throw new Error("Unknown status.");

  const next = nextStatus(ticket.status);
  if (!next) throw new Error("Already done.");

  const patch: { status: typeof next; waiting?: boolean } = { status: next };
  if (next === "done") patch.waiting = false;

  const { error: updateError } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", ticketId);
  if (updateError) throw new Error(updateError.message);

  const { error: noteError } = await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    kind: "status",
    body: advanceLabel(ticket.status) ?? `Status: ${STATUS_LABELS[next]}`,
    created_by: session.user.id,
  });
  if (noteError) throw new Error(noteError.message);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
