export const PORTAL_BUCKET = "portal-assets";

/** URL pública de um objeto do bucket do portal */
export function publicAssetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/${PORTAL_BUCKET}/${path}`;
}
