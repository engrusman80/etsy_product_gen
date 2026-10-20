import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { pickIdeas } from "../../crochet/curated";

export default defineTool({
  name: "suggest_crochet_ideas",
  title: "Suggest crochet pattern ideas",
  description: "Return a random selection of curated, trending crochet pattern ideas for Etsy.",
  inputSchema: { count: z.number().int().min(1).max(30).optional().describe("How many ideas (default 8).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: ({ count }) => {
    const ideas = pickIdeas(count ?? 8);
    return { content: [{ type: "text", text: ideas.join("\n") }], structuredContent: { ideas } };
  },
});
