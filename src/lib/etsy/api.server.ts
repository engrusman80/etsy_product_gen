/**
 * Server-side Etsy Open API v3 calls. The browser sends the user's own app keystring, shared
 * secret and OAuth token with each request; nothing is stored on the server.
 */

const API = "https://api.etsy.com/v3";

export type EtsyCreds = { keystring: string; secret: string; token?: string };

export class EtsyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function credsFrom(request: Request): EtsyCreds {
  return {
    keystring: request.headers.get("x-etsy-key")?.trim() || "",
    secret: request.headers.get("x-etsy-secret")?.trim() || "",
    token: request.headers.get("x-etsy-token")?.trim() || undefined,
  };
}

async function etsy<T>(
  creds: EtsyCreds,
  path: string,
  init: { method?: string; form?: Record<string, string>; body?: FormData } = {},
): Promise<T> {
  if (!creds.keystring || !creds.secret)
    throw new EtsyError("Add your Etsy keystring and shared secret in Settings.", 400);
  const headers: Record<string, string> = {
    // Etsy requires "keystring:shared_secret" on every v3 request since 2026.
    "x-api-key": `${creds.keystring}:${creds.secret}`,
  };
  if (creds.token) headers.Authorization = `Bearer ${creds.token}`;
  let body: BodyInit | undefined = init.body;
  if (init.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init.form).toString();
  }
  const res = await fetch(`${API}${path}`, { method: init.method ?? "GET", headers, body });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string };
      msg = j.error_description || j.error || text;
    } catch {
      /* plain text error */
    }
    throw new EtsyError(`Etsy ${res.status}: ${String(msg).slice(0, 300)}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type Tokens = { access_token: string; refresh_token: string; expires_in: number };

export function exchangeCode(
  creds: EtsyCreds,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<Tokens> {
  return etsy<Tokens>(creds, "/public/oauth/token", {
    method: "POST",
    form: {
      grant_type: "authorization_code",
      client_id: creds.keystring,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    },
  });
}

export function refreshTokens(creds: EtsyCreds, refreshToken: string): Promise<Tokens> {
  return etsy<Tokens>(creds, "/public/oauth/token", {
    method: "POST",
    form: { grant_type: "refresh_token", client_id: creds.keystring, refresh_token: refreshToken },
  });
}

export async function getMyShop(creds: EtsyCreds) {
  const me = await etsy<{ user_id: number; shop_id?: number }>(creds, "/application/users/me");
  if (!me.shop_id) throw new EtsyError("This Etsy account has no shop.", 404);
  const shop = await etsy<{ shop_id: number; shop_name: string; url?: string }>(
    creds,
    `/application/shops/${me.shop_id}`,
  );
  return { shopId: shop.shop_id, shopName: shop.shop_name };
}

export type EtsyListing = {
  listing_id: number;
  title: string;
  description: string;
  tags: string[];
  state: string;
  url?: string;
  price?: { amount: number; divisor: number; currency_code: string };
  taxonomy_id?: number;
  who_made?: string;
};

export async function getActiveListings(creds: EtsyCreds, shopId: number) {
  const out: EtsyListing[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await etsy<{ count: number; results: EtsyListing[] }>(
      creds,
      `/application/shops/${shopId}/listings?state=active&limit=100&offset=${offset}`,
    );
    out.push(...page.results);
    if (out.length >= page.count || page.results.length < 100) break;
  }
  return out;
}

export function updateListing(
  creds: EtsyCreds,
  shopId: number,
  listingId: number,
  fields: { title?: string; description?: string; tags?: string[] },
) {
  const form: Record<string, string> = {};
  if (fields.title) form.title = fields.title;
  if (fields.description) form.description = fields.description;
  if (fields.tags) form.tags = fields.tags.join(",");
  return etsy<EtsyListing>(creds, `/application/shops/${shopId}/listings/${listingId}`, {
    method: "PATCH",
    form,
  });
}

type TaxNode = { id: number; name: string; children?: TaxNode[] };
let taxonomy: { id: number; path: string }[] | null = null;

/** Picks the seller taxonomy whose path matches the most of the given words, deepest first. */
export async function findTaxonomy(
  creds: EtsyCreds,
  wanted: string[],
): Promise<{ id: number; path: string }> {
  if (!taxonomy) {
    const tree = await etsy<{ results: TaxNode[] }>(creds, "/application/seller-taxonomy/nodes");
    const flat: { id: number; path: string }[] = [];
    const walk = (nodes: TaxNode[], prefix: string) => {
      for (const n of nodes) {
        const path = prefix ? `${prefix} > ${n.name}` : n.name;
        flat.push({ id: n.id, path });
        if (n.children?.length) walk(n.children, path);
      }
    };
    walk(tree.results, "");
    taxonomy = flat;
  }
  const lower = wanted.map((w) => w.toLowerCase());
  let best = taxonomy[0];
  let bestScore = -1;
  for (const t of taxonomy) {
    const p = t.path.toLowerCase();
    const hits = lower.filter((w) => p.includes(w)).length;
    // Prefer more matches, then the more specific (deeper) category.
    const score = hits * 10 + (hits ? t.path.split(">").length : 0);
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

export type DraftInput = {
  title: string;
  description: string;
  tags: string[];
  price: number;
  taxonomyWords: string[];
  /** Base64 JPEG/PNG listing photos, first one is the thumbnail. */
  images: string[];
  /** Files the buyer downloads. */
  files: { name: string; base64: string }[];
};

const b64ToBlob = (b64: string, type: string) =>
  new Blob([Buffer.from(b64.replace(/^data:[^,]+,/, ""), "base64")], { type });

/** Creates an inactive DRAFT digital listing. It never activates or publishes anything. */
export async function createDraft(creds: EtsyCreds, shopId: number, d: DraftInput) {
  const tax = await findTaxonomy(creds, d.taxonomyWords);
  const listing = await etsy<EtsyListing>(creds, `/application/shops/${shopId}/listings`, {
    method: "POST",
    form: {
      quantity: "999",
      title: d.title.slice(0, 140),
      description: d.description,
      price: d.price.toFixed(2),
      who_made: "i_did",
      when_made: "made_to_order",
      is_supply: "false",
      type: "download",
      taxonomy_id: String(tax.id),
      tags: d.tags.slice(0, 13).join(","),
    },
  });
  const id = listing.listing_id;
  const problems: string[] = [];
  for (const [i, img] of d.images.slice(0, 10).entries()) {
    const fd = new FormData();
    fd.append("image", b64ToBlob(img, "image/jpeg"), `photo-${i + 1}.jpg`);
    fd.append("rank", String(i + 1));
    try {
      await etsy(creds, `/application/shops/${shopId}/listings/${id}/images`, {
        method: "POST",
        body: fd,
      });
    } catch (e) {
      problems.push(`photo ${i + 1}: ${(e as Error).message}`);
    }
  }
  for (const [i, f] of d.files.slice(0, 5).entries()) {
    const fd = new FormData();
    fd.append("file", b64ToBlob(f.base64, "application/octet-stream"), f.name);
    fd.append("name", f.name);
    fd.append("rank", String(i + 1));
    try {
      await etsy(creds, `/application/shops/${shopId}/listings/${id}/files`, {
        method: "POST",
        body: fd,
      });
    } catch (e) {
      problems.push(`file ${f.name}: ${(e as Error).message}`);
    }
  }
  return {
    listingId: id,
    category: tax.path,
    editUrl: `https://www.etsy.com/your/shops/me/listing-editor/edit/${id}`,
    problems,
  };
}
