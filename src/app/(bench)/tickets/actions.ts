"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBenchSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dueAtForCreate } from "@/lib/tickets/datetime";
import {
  benchStateNote,
  isBenchState,
  patchForBenchState,
  storedBenchState,
} from "@/lib/tickets/status";
import {
  isTicketStatus,
} from "@/lib/tickets/types";

function requiredText(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export async function createTicket(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();

  const customerName = requiredText(formData, "customer_name");
  const symptom = requiredText(formData, "symptom");
  const dueAt = dueAtForCreate("walk_in", null);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({ name: customerName, phone: null, email: null })
    .select("id")
    .single();
  if (customerError || !customer) {
    throw new Error(customerError?.message ?? "Could not save customer.");
  }

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .insert({
      customer_id: customer.id,
      label: "Device",
      serial: null,
    })
    .select("id")
    .single();
  if (deviceError || !device) {
    throw new Error(deviceError?.message ?? "Could not save device.");
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      customer_id: customer.id,
      device_id: device.id,
      symptom,
      status: "intake",
      waiting: false,
      arrival_kind: "walk_in",
      due_at: dueAt.toISOString(),
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (ticketError || !ticket) {
    throw new Error(ticketError?.message ?? "Could not open ticket.");
  }

  await supabase.from("ticket_notes").insert({
    ticket_id: ticket.id,
    kind: "status",
    body: "Opened.",
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

  const { error } = await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    kind: "note",
    body,
    created_by: session.user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/more");
}

export async function setBenchState(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();
  const ticketId = requiredText(formData, "ticket_id");
  const stateRaw = requiredText(formData, "state");
  if (!isBenchState(stateRaw)) {
    throw new Error("Choose Open, Waiting, or Done.");
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, status, waiting")
    .eq("id", ticketId)
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Ticket not found.");
  if (!isTicketStatus(ticket.status)) throw new Error("Unknown status.");
  if (storedBenchState(ticket) === stateRaw) return;

  const patch = patchForBenchState(stateRaw, ticket.status);
  const { error: updateError } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", ticketId);
  if (updateError) throw new Error(updateError.message);

  const { error: noteError } = await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    kind: "status",
    body: benchStateNote(stateRaw),
    created_by: session.user.id,
  });
  if (noteError) throw new Error(noteError.message);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/more");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
