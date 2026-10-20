import { defineMcp } from "@lovable.dev/mcp-js";
import trending from "./tools/trending";
import crochetIdeas from "./tools/crochet-ideas";
import policyCheck from "./tools/policy-check";

export default defineMcp({
  name: "etsy-digital-product-generator",
  title: "Etsy Digital Product Generator",
  version: "0.1.0",
  instructions:
    "Idea and policy tools for Etsy and Adobe Stock products. Use `list_trending_stock_prompts` for high-demand stock ideas, `suggest_crochet_ideas` for crochet pattern ideas, and `check_stock_policy` before generating content.",
  tools: [trending, crochetIdeas, policyCheck],
});
