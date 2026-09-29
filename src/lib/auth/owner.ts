export function ownerEmail(): string | null {
  const value = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  return value.includes("@") ? value : null;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = ownerEmail();
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner;
}
