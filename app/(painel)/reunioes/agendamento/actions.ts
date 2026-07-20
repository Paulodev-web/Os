"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BookingSlotDay } from "@/lib/database.types";

function parseSlots(raw: string): BookingSlotDay[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        s &&
        typeof s.date === "string" &&
        Array.isArray(s.times) &&
        s.times.every((t: unknown) => typeof t === "string")
    );
  } catch {
    return [];
  }
}

export async function createBookingLink(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? 60);
  const meetingType = String(formData.get("meeting_type") ?? "comercial");
  const spaceId = String(formData.get("space_id") ?? "");
  if (!title || !spaceId || !Number.isFinite(durationMinutes) || durationMinutes <= 0)
    return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("booking_links")
    .insert({
      slug: nanoid(10),
      title,
      description: description || null,
      duration_minutes: durationMinutes,
      meeting_type: meetingType,
      space_id: spaceId,
      slots: [],
    })
    .select("id")
    .single();
  revalidatePath("/reunioes/agendamento");
  if (error) redirect(`/reunioes/agendamento?erro=${encodeURIComponent(error.message)}`);
  if (data) redirect(`/reunioes/agendamento/${data.id}`);
}

export async function updateBookingLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") ?? 60);
  const meetingType = String(formData.get("meeting_type") ?? "comercial");
  const slots = parseSlots(String(formData.get("slots") ?? "[]"));
  if (!id || !title || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_links")
    .update({
      title,
      description: description || null,
      duration_minutes: durationMinutes,
      meeting_type: meetingType,
      slots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath(`/reunioes/agendamento/${id}`);
  revalidatePath("/reunioes/agendamento");
  if (error) redirect(`/reunioes/agendamento/${id}?erro=${encodeURIComponent(error.message)}`);
}

export async function toggleBookingLinkActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("booking_links")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/reunioes/agendamento");
  revalidatePath(`/reunioes/agendamento/${id}`);
  if (error) redirect(`/reunioes/agendamento?erro=${encodeURIComponent(error.message)}`);
}

export async function deleteBookingLink(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("booking_links").delete().eq("id", id);
  revalidatePath("/reunioes/agendamento");
  if (error) redirect(`/reunioes/agendamento?erro=${encodeURIComponent(error.message)}`);
  redirect("/reunioes/agendamento");
}

export async function createBlock(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const startTime = String(formData.get("start_time") ?? "");
  const endTime = String(formData.get("end_time") ?? "");
  if (!title || !date || !startTime || !endTime) return;

  const supabase = await createClient();
  const { error } = await supabase.from("booking_blocks").insert({
    title,
    date,
    start_time: startTime,
    end_time: endTime,
  });
  revalidatePath("/reunioes/agendamento");
  if (error) redirect(`/reunioes/agendamento?erro=${encodeURIComponent(error.message)}`);
}

export async function deleteBlock(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("booking_blocks").delete().eq("id", id);
  revalidatePath("/reunioes/agendamento");
  if (error) redirect(`/reunioes/agendamento?erro=${encodeURIComponent(error.message)}`);
}
