// Adobe Stock content policy guardrails.
// Block prompts that obviously violate: trademarks, celebrities, brands,
// copyrighted characters, identifiable real people, currency, flags, etc.
// This is a first-line filter — the model itself may still refuse.

export const BLOCKED_TERMS: string[] = [
  // Brands / companies
  "nike", "adidas", "puma", "apple", "iphone", "ipad", "macbook", "samsung", "google",
  "microsoft", "windows", "android", "facebook", "instagram", "tiktok", "youtube",
  "twitter", "x logo", "netflix", "disney", "pixar", "marvel", "dc comics", "warner bros",
  "starbucks", "coca cola", "coca-cola", "pepsi", "mcdonald", "burger king", "kfc",
  "ferrari", "lamborghini", "porsche", "bmw", "mercedes", "tesla", "toyota", "ford",
  "rolex", "gucci", "louis vuitton", "chanel", "prada", "supreme",
  // Characters / IP
  "mickey mouse", "minnie mouse", "spider-man", "spiderman", "batman", "superman",
  "iron man", "captain america", "wonder woman", "harry potter", "star wars",
  "darth vader", "yoda", "pokemon", "pikachu", "mario", "sonic", "elsa", "frozen",
  "barbie", "lego", "minion", "shrek", "simpsons", "snoopy", "garfield", "hello kitty",
  "naruto", "goku", "dragon ball",
  // Celebrities / public figures
  "taylor swift", "beyonce", "rihanna", "kanye", "drake", "messi", "ronaldo",
  "elon musk", "trump", "biden", "obama", "putin", "modi",
  "kardashian", "jenner",
  // Restricted symbols
  "currency", "dollar bill", "euro note", "passport", "credit card number",
  "national flag", "olympic rings", "olympics",
];

export type PolicyResult = { ok: true } | { ok: false; reason: string; term: string };

/** Quick keyword check. Returns first violation. */
export function checkAdobePolicy(prompt: string): PolicyResult {
  const p = prompt.toLowerCase();
  for (const term of BLOCKED_TERMS) {
    // word-ish boundary so "applesauce" doesn't match "apple"
    const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    if (re.test(p)) {
      return { ok: false, term, reason: `Prompt references "${term}" — Adobe Stock prohibits trademarks, brands, celebrities and copyrighted characters.` };
    }
  }
  return { ok: true };
}

/** Append a negative-prompt clause that nudges the model away from IP / people releases / text. */
export const ADOBE_NEGATIVE_CLAUSE =
  "Strictly Adobe-Stock-compliant: NO logos, NO brand names, NO trademarks, NO copyrighted characters, NO real or identifiable people, NO celebrities, NO text or watermarks, NO currency, NO national flags, NO famous landmarks with restricted releases. Original, generic, commercially-licensable artwork only.";
