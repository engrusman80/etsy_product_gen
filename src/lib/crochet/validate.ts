import type { CrochetPattern } from "./types";

/**
 * Checks stitch counts in a generated pattern, so a buyer never gets rows that don't add up
 * (the main cause of bad reviews on crochet patterns). Deliberately conservative: a row is only
 * checked when every part of it is understood; anything unusual is left alone.
 */

type Tally = { use: number; make: number };

// stitch -> stitches used from the previous round, stitches made
const STITCHES: Record<string, Tally> = {
  sc: { use: 1, make: 1 },
  hdc: { use: 1, make: 1 },
  dc: { use: 1, make: 1 },
  tr: { use: 1, make: 1 },
  slst: { use: 1, make: 1 },
  "sl st": { use: 1, make: 1 },
  inc: { use: 1, make: 2 },
  dec: { use: 2, make: 1 },
  invdec: { use: 2, make: 1 },
  "inv dec": { use: 2, make: 1 },
  sc2tog: { use: 2, make: 1 },
};
const STITCH = Object.keys(STITCHES)
  .sort((a, b) => b.length - a.length)
  .map((s) => s.replace(" ", "\\s"))
  .join("|");
const TIMES = "(?:\\s*[x×*]\\s*|\\s+)";
const MOD = "(?:(?:blo|flo|in\\s+(?:blo|flo))\\s+)?";

/** Parses one stitch group such as "sc 3", "3 sc", "inc × 6" or "sc in next 4 sts". */
function part(text: string): Tally | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || /^(ch \d+,? )?turn$|^ch 1$/.test(t)) return { use: 0, make: 0 };
  let m = t.match(
    new RegExp(`^${MOD}(${STITCH})(?: in (?:next|each of next) (\\d+)(?: sts?)?|${TIMES}(\\d+))?$`),
  );
  if (m) {
    const s = STITCHES[m[1].replace(/\s+/, " ")];
    const n = Number(m[2] ?? m[3] ?? 1);
    return { use: s.use * n, make: s.make * n };
  }
  m = t.match(new RegExp(`^(\\d+) ${MOD}(${STITCH})$`));
  if (m) {
    const s = STITCHES[m[2].replace(/\s+/, " ")];
    const n = Number(m[1]);
    return { use: s.use * n, make: s.make * n };
  }
  return null;
}

function sum(list: string, prev: number | null): Tally | null {
  // "sc in each st around" / "sc around": one stitch in each stitch of the last round.
  const around = list
    .trim()
    .toLowerCase()
    .match(new RegExp(`^${MOD}(${STITCH})(?: in each st)?(?: around| across)?$`));
  if (around && /around|across|each st/.test(list) && prev != null) {
    const s = STITCHES[around[1].replace(/\s+/, " ")];
    return s.use === 1 ? { use: prev, make: prev * s.make } : null;
  }
  const total = { use: 0, make: 0 };
  // Split on commas that are not inside brackets.
  const pieces: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if ("([".includes(ch)) depth++;
    if (")]".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      pieces.push(cur);
      cur = "";
    } else cur += ch;
  }
  pieces.push(cur);
  for (const p of pieces) {
    const rep = p.trim().match(/^[([](.+)[)\]]\s*[x×*]\s*(\d+)(?: times)?$/i);
    const one = rep ? sum(rep[1], null) : part(p);
    if (!one) return null;
    const n = rep ? Number(rep[2]) : 1;
    total.use += one.use * n;
    total.make += one.make * n;
  }
  return total;
}

export function checkStitchCounts(p: Pick<CrochetPattern, "sections">): string[] {
  const issues: string[] = [];
  for (const section of p.sections ?? []) {
    let prev: number | null = null;
    for (const raw of section.rows ?? []) {
      const row = String(raw);
      const label = row.match(/^\s*([^:]{1,14}):/)?.[1]?.trim();
      const where = `${section.name}${label ? ` ${label}` : ""}`;
      const count = row.match(/\((\d+)\s*(?:sts?|stitches)?\)\s*\.?\s*$/i);
      if (!count) {
        if (/^\s*r(?:ow|nd|ound)?\s*\d/i.test(row))
          issues.push(`${where}: missing stitch count "(N)" at the end`);
        continue;
      }
      const stated = Number(count[1]);
      const body = row
        .slice(0, count.index)
        .replace(/^[^:]*:\s*/, "")
        .replace(/\s*[.;]\s*$/, "")
        .trim();
      const ring = body.match(
        new RegExp(
          `^(\\d+) (${STITCH}) in (?:a )?(?:magic ring|mr|magic loop|adjustable ring)`,
          "i",
        ),
      );
      if (ring) {
        if (Number(ring[1]) !== stated)
          issues.push(`${where}: says ${ring[1]} sts in the ring but counts (${stated})`);
        prev = stated;
        continue;
      }
      const t = sum(body, prev);
      if (t && prev != null) {
        if (t.use !== prev)
          issues.push(`${where}: works ${t.use} sts but the previous round has ${prev}`);
        else if (t.make !== stated)
          issues.push(`${where}: makes ${t.make} sts but says (${stated})`);
      }
      prev = stated;
    }
  }
  return issues;
}
