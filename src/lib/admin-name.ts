// Derive a friendly first-name display for admins.
// Super admins always render as "EMANUAL" (all caps), as specified.
// Other admins show their first name only, capitalized.

export function firstNameFrom(opts: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const { displayName, email } = opts;
  const source =
    (displayName && displayName.trim()) ||
    (email ? email.split("@")[0] : "") ||
    "";
  if (!source) return "Admin";
  // Split on space, dot, underscore, dash, or digits
  const first = source.split(/[\s._\-0-9]+/).filter(Boolean)[0] ?? source;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function adminDisplayName(opts: {
  role: string | null | undefined;
  displayName?: string | null;
  email?: string | null;
}): string {
  if (opts.role === "super_admin") return "EMANUAL";
  return firstNameFrom({ displayName: opts.displayName, email: opts.email });
}
