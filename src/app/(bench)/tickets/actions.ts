"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBenchSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dueAtForCreate, formatShopDateTime } from "@/lib/tickets/datetime";
import {
  isMarkAsStatus,
  markAsNoteBody,
} from "@/lib/tickets/status";
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

export async function markTicketStatus(formData: FormData): Promise<void> {
  const session = await requireBenchSession();
  const supabase = await createClient();
  const ticketId = requiredText(formData, "ticket_id");
  const statusRaw = requiredText(formData, "status");
  if (!isMarkAsStatus(statusRaw)) {
    throw new Error("Choose Diagnose, Parts, or Done.");
  }

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, status")
    .eq("id", ticketId)
    .single();
  if (error || !ticket) throw new Error(error?.message ?? "Ticket not found.");
  if (!isTicketStatus(ticket.status)) throw new Error("Unknown status.");
  if (ticket.status === statusRaw) return;

  const patch: { status: typeof statusRaw; waiting: boolean } = {
    status: statusRaw,
    waiting: false,
  };

  const { error: updateError } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", ticketId);
  if (updateError) throw new Error(updateError.message);

  const { error: noteError } = await supabase.from("ticket_notes").insert({
    ticket_id: ticketId,
    kind: "status",
    body: markAsNoteBody(statusRaw),
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
