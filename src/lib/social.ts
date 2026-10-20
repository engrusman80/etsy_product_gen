export type SocialPlatform = "instagram" | "pinterest" | "facebook" | "etsy" | "website";

function stripProto(s: string) {
  return s.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

export function normalizeSocial(
  value: string | undefined,
  platform: SocialPlatform
): { url: string; display: string } | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    return { url: raw, display: stripProto(raw) };
  }
  const handle = raw.replace(/^@/, "").replace(/^\/+/, "");
  if (platform === "website" || /\.[a-z]{2,}/i.test(handle)) {
    const url = `https://${stripProto(handle)}`;
    return { url, display: stripProto(url) };
  }
  const bases: Record<Exclude<SocialPlatform, "website">, string> = {
    instagram: "https://instagram.com/",
    pinterest: "https://pinterest.com/",
    facebook: "https://facebook.com/",
    etsy: "https://etsy.com/shop/",
  };
  const url = `${bases[platform as Exclude<SocialPlatform, "website">]}${handle}`;
  return { url, display: stripProto(url) };
}

export function pinterestShareUrl(opts: { url: string; description: string; media?: string }) {
  const p = new URLSearchParams();
  p.set("url", opts.url);
  p.set("description", opts.description);
  if (opts.media) p.set("media", opts.media);
  return `https://pinterest.com/pin/create/button/?${p.toString()}`;
}

export function facebookShareUrl(opts: { url: string; quote?: string }) {
  const p = new URLSearchParams();
  p.set("u", opts.url);
  if (opts.quote) p.set("quote", opts.quote);
  return `https://www.facebook.com/sharer/sharer.php?${p.toString()}`;
}
