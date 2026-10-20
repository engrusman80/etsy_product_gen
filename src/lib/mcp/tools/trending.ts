import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { TRENDING_PROMPTS, filterTrending, type TrendingPrompt } from "../../adobe-stock/trending-prompts";

const toJson = (p: TrendingPrompt) => ({
  id: p.id, label: p.label, category: p.category, prompt: p.prompt,
  bestFor: [...p.bestFor], bestAspect: p.bestAspect ?? null,
});

export default defineTool({
  name: "list_trending_stock_prompts",
  title: "List trending Adobe Stock prompts",
  description: "List curated, policy-safe, high-demand Adobe Stock prompt ideas, optionally filtered by asset type.",
  inputSchema: {
    assetType: z.enum(["jpeg", "png", "svg", "wallpaper"]).optional().describe("Filter by asset type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ assetType }) => {
    const items = (assetType ? filterTrending(assetType) : TRENDING_PROMPTS).map(toJson);
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }], structuredContent: { prompts: items } };
  },
});
