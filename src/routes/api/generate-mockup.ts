import { createFileRoute } from "@tanstack/react-router";
import { resolveProvider, callImage, statusFromError } from "@/lib/ai-call.server";

const MOCKUP_PROMPTS: Record<string, string> = {
  "digital-download":
    'Generate a square Etsy digital download cover image. Background: light whitewashed wood plank texture. Top: a dark charcoal blue-gray (#2f3d4a) full-width banner with centered bold white uppercase text "BEST QUALITY INSTANT DOWNLOAD DIGITAL FILE". Center: place the provided artwork flat on the wood, centered, ~60% width. Bottom: a row of 7 dark charcoal blue-gray (#2f3d4a) rounded pill badges, equally spaced, each with bold white uppercase text in order: SVG, EPS, AI, PDF, JPG, PNG, DXF. Sharp, high resolution, no extra text or logos.',
  "banner-top-bottom":
    'Generate a square Etsy digital download cover image. Background: light whitewashed wood plank texture. TOP: a dark charcoal blue-gray (#2f3d4a) full-width banner with centered bold white uppercase text "BEST QUALITY INSTANT DOWNLOAD DIGITAL FILE". BOTTOM: an identical dark charcoal blue-gray (#2f3d4a) full-width banner with the same centered bold white uppercase text "BEST QUALITY INSTANT DOWNLOAD DIGITAL FILE". Center: place the provided artwork flat on the wood, centered, ~62% width, perfectly aligned, true colors, tack-sharp edges. No extra text, no badges, no logos.',
  "white-tshirt":
    "Place the provided artwork centered on the chest of a plain white cotton t-shirt, professional flat-lay product photography, soft natural lighting, clean light gray background, realistic fabric texture and folds, the artwork should appear printed on the fabric.",
  "black-tshirt":
    "Place the provided artwork centered on the chest of a plain black cotton t-shirt, professional flat-lay product photography, soft studio lighting, clean dark gray background, realistic fabric texture, artwork printed on the fabric.",
  hoodie:
    "Place the provided artwork centered on the chest of a heather gray pullover hoodie, professional product photography on a wooden background, realistic fabric texture and folds.",
  mug: "Wrap the provided artwork around a glossy white ceramic 11oz coffee mug, professional product photography, soft natural light, clean beige background, realistic ceramic reflections.",
  "tote-bag":
    "Place the provided artwork centered on a natural canvas tote bag hanging against a light beige wall, professional lifestyle product photography, soft daylight.",
  "wall-frame":
    "Display the provided artwork inside a thin black wooden poster frame mounted on a light minimalist living room wall, professional interior product photography, soft daylight, slight perspective.",
  pillow:
    "Place the provided artwork centered on a square throw pillow on a beige linen sofa, cozy lifestyle photography, soft daylight.",
  sticker:
    "Show the provided artwork as a die-cut vinyl sticker with a thin white border, placed on a wooden desk next to a laptop and notebook, professional product photography.",
  "baby-onesie":
    "Place the provided artwork centered on the chest of a white cotton baby onesie, flat-lay on a soft pastel blanket, professional product photography, soft daylight.",
  "canvas-print":
    "Display the provided artwork as a stretched gallery canvas wall print on a neutral living-room wall, slight 3/4 perspective, soft daylight, professional interior photography.",
  "phone-case":
    "Print the provided artwork on the back of a modern smartphone case, hero product shot on a clean gradient background, realistic plastic finish, professional product photography.",
  "notebook-cover":
    "Print the provided artwork on the cover of a hardcover A5 notebook, flat-lay on a wooden desk with a pen, professional product photography, soft daylight.",
  "greeting-card":
    "Print the provided artwork on the front of a folded greeting card, standing on a wooden desk next to an envelope, professional product photography, soft daylight.",
  apron:
    "Print the provided artwork centered on the chest of a beige linen kitchen apron hanging on a wooden hook, professional lifestyle product photography.",
  cap: "Embroider/print the provided artwork on the front of a black baseball cap, hero product shot on a soft gray background, professional product photography.",
  "wood-sign":
    "Print the provided artwork on a rustic rectangular wooden hanging sign with rope, displayed on a white shiplap wall, professional interior product photography.",
  "metal-print":
    "Display the provided artwork as a glossy aluminum metal wall print floating on a minimalist concrete wall, soft directional light, professional interior product photography.",
  "enamel-pin":
    "Render the provided artwork as a hard enamel lapel pin with glossy gold metal outline, photographed on a textured paper background, macro product photography.",
  coaster:
    "Print the provided artwork on a square cork-backed drink coaster, flat-lay on a wooden table with a coffee cup beside, professional product photography.",
  "baseball-tee":
    "Place the provided artwork centered on the chest of a white baseball tee with black 3/4 sleeves, flat-lay on a wooden surface, professional product photography.",
  puzzle:
    "Print the provided artwork on a rectangular jigsaw puzzle, hero shot on a clean wooden table, slight 3/4 perspective, professional product photography.",
  tumbler:
    "Wrap the provided artwork fully around a glossy 20oz stainless steel skinny tumbler with a clear lid and metal straw, sublimation print look, hero product shot on a soft neutral background, realistic reflections, professional product photography.",
  "sticker-sheet-mockup":
    "Show the provided artwork printed as a glossy kiss-cut vinyl sticker sheet lying on a pastel desk next to scissors, a pen and a planner, slight angle, soft daylight, professional flat-lay product photography.",
  "clipart-flatlay":
    "Etsy clipart preview: show the provided illustrated elements used on a stylish flat-lay of craft projects (a scrapbook page, an invitation card and a gift tag) on a light marble desk, soft daylight, professional product photography, elements keep their exact look.",
  "gallery-wall":
    "Display the provided artwork as the large centerpiece print in a natural oak frame with a white mat on a warm neutral living room wall above a styled console table with a vase, professional interior photography, soft daylight, accurate print colors, no other artwork.",
  "coloring-page-mockup":
    "Show the provided coloring page printed on a sheet of white paper lying on a wooden table, partly colored in with colored pencils, with a few pencils and a cup of tea beside it, overhead flat-lay, soft daylight, professional product photography.",
  "digital-paper-mockup":
    "Etsy digital paper preview: show the provided pattern as several overlapping square paper sheets fanned out on a white desk, plus the pattern used on a wrapped gift box, soft daylight, professional flat-lay product photography, pattern scale and colors unchanged.",
  "planner-mockup":
    "Show the provided planner page printed on white paper inside an open ring binder on a light wooden desk with a pen, a coffee cup and a small plant, overhead flat-lay, soft daylight, professional product photography.",
  "ipad-planner":
    "Show the provided planner page displayed on the screen of a modern iPad with an Apple Pencil-style stylus beside it, on a minimalist desk, slight angle, soft daylight, professional product photography, screen content sharp and unchanged.",
  "invitation-flatlay":
    "Show the provided card design printed as a 5x7 invitation card on textured cardstock with a matching envelope, wax seal and dried flowers, elegant overhead flat-lay on linen, soft daylight, professional stationery photography.",
  "phone-screen":
    "Show the provided image as the lock-screen wallpaper on a modern smartphone held in a hand against a soft blurred aesthetic background, the wallpaper fills the whole screen with a lock-screen clock at the top, professional lifestyle product photography.",
  blanket:
    "Print the provided artwork on a soft fleece throw blanket draped on a cream sofa, cozy lifestyle photography, soft daylight.",

  // ==== Crochet pattern PDF listing mockups ====
  // Text-overlay cover (matches the reference "Nautilus Shell Bag / Crochet Guide" layout).
  // The caller MUST pass extra fields via `tweak` (product name, page count, skill level, tagline).
  "crochet-cover":
    "Elegant Etsy digital-download cover for a crochet PATTERN PDF listing, SQUARE 1:1. LEFT HALF (about 55%): show the provided finished crocheted item photograph on a soft neutral styled background (linen, marble, or warm off-white) with tasteful props (dried florals, small stones, natural light). RIGHT HALF: creamy off-white panel with elegant typography — a small ornamental flourish on top, then the product name in a large graceful serif italic script (dark navy or muted rose), then the subtitle 'CROCHET GUIDE' in refined uppercase letter-spaced sans, then 3 small round icon+label rows describing page count, step-by-step, beginner-friendly. Bottom: a soft pill-shaped ribbon that says 'BEAUTIFUL · PRACTICAL · HANDMADE — Made with Love'. Overall aesthetic: airy, premium Etsy handmade brand, pastel neutral palette, hairline dividers, luxurious white space, no logos, no watermarks, tack-sharp print quality.",
  "crochet-lifestyle":
    "Beautiful lifestyle photograph of the provided finished crochet item styled naturally in a cozy real-life setting (sunlit windowsill with linen, wooden shelf, marble kitchen counter, or beach sand depending on the piece). Natural daylight, shallow depth of field, warm neutral palette, magazine-quality craft photography, no text, no logos, tack-sharp.",
  "crochet-flatlay":
    "Overhead flat-lay of the provided finished crocheted piece on a soft neutral background (linen fabric or warm off-white paper), styled with tasteful crochet props (bamboo hook, small ball of ivory yarn, tiny wooden buttons, dried flower sprig). Balanced composition, even soft daylight, no text, no logos, professional Etsy product photography.",
  "crochet-inuse":
    "Realistic in-use / worn photograph showing the provided finished crocheted item being used or worn by a person in a natural everyday setting (cropped tastefully — no faces required). Soft natural light, cinematic warm tone, handmade artisan feel, no text, no logos, professional lifestyle photography.",
  "crochet-detail":
    "Ultra close-up macro detail shot of the provided finished crocheted item, showing crisp stitch texture and yarn fibers, dramatic soft light, extremely sharp focus, neutral background, no text, no logos, premium handmade craft photography.",
};

export const Route = createFileRoute("/api/generate-mockup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { image, mockup, customPrompt, tweak, formats } = (await request.json()) as {
            image: string;
            mockup: string;
            customPrompt?: string;
            tweak?: string;
            formats?: string[];
          };
          if (!image || !mockup) return Response.json({ error: "Missing fields" }, { status: 400 });

          let prompt: string;
          if (mockup.startsWith("custom:")) {
            const subject = (customPrompt || mockup.slice(7)).trim();
            if (!subject)
              return Response.json({ error: "Custom mockup needs a description" }, { status: 400 });
            prompt = `Professional Etsy product mockup: place the provided artwork realistically on/in a ${subject}. Studio product photography, clean neutral background, soft natural lighting, accurate perspective and surface texture, the artwork should look genuinely printed/applied on the product, true-to-life colors, tack-sharp focus.`;
          } else {
            const p = MOCKUP_PROMPTS[mockup];
            if (!p) return Response.json({ error: "Unknown mockup type" }, { status: 400 });
            prompt = p;
            // The download cover lists the files this product type actually ships with.
            if (mockup === "digital-download" && Array.isArray(formats) && formats.length) {
              const badges = formats.slice(0, 7).map((f) => String(f).toUpperCase().slice(0, 12));
              prompt = prompt.replace(
                /a row of 7 [^.]+\./,
                `a row of ${badges.length} dark charcoal blue-gray (#2f3d4a) rounded pill badges, equally spaced, each with bold white uppercase text in order: ${badges.join(", ")}.`,
              );
            }
          }
          if (tweak && tweak.trim()) {
            prompt += ` Additional user-requested adjustments: ${tweak.trim()}.`;
          }
          prompt +=
            " Ultra high resolution (square 1588x1588 minimum), tack-sharp focus, no blur, no noise, no JPEG artifacts, professional studio product photography, 4K detail, crisp clean edges, true-to-life colors, perfectly zoomable without pixelation.";

          const { provider, key } = resolveProvider(request);
          if (!key)
            return Response.json(
              { error: `Missing API key for ${provider}. Add it in Settings.` },
              { status: 401 },
            );

          // Listing photos are what buyers see first and Etsy asks for 2000px, so the best setting
          // uses the Pro image model at 2K; "fast" keeps the cheaper ~1K Flash model.
          const hires = request.headers.get("x-image-quality") !== "fast";
          let lastErr: unknown = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const b64 = await callImage({
                provider,
                key,
                prompt,
                inputImageB64: image,
                hires,
                imageSize: hires ? "2K" : undefined,
              });
              return Response.json({ image: b64 });
            } catch (e) {
              lastErr = e;
              const s = statusFromError(e);
              if (s === 401 || s === 402 || s === 429) break;
            }
          }
          const status = statusFromError(lastErr);
          const msg = (lastErr as Error)?.message || "Mockup failed";
          if (status === 429) return Response.json({ error: "Rate limit reached." }, { status });
          if (status === 402) return Response.json({ error: "AI credits exhausted." }, { status });
          if (status === 401)
            return Response.json({ error: "Invalid API key. Check Settings." }, { status });
          return Response.json({ error: msg }, { status });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
