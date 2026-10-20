import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { checkAdobePolicy } from "../../adobe-stock/policy";

export default defineTool({
  name: "check_stock_policy",
  title: "Check Adobe Stock policy",
  description: "Check a prompt for blocked brands, celebrities, or characters that violate Adobe Stock policy.",
  inputSchema: { prompt: z.string().min(1).describe("Prompt text to check.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ prompt }) => {
    const r = checkAdobePolicy(prompt);
    const result = r.ok ? { ok: true, reason: null, term: null } : { ok: false, reason: r.reason, term: r.term };
    return {
      content: [{ type: "text", text: r.ok ? "Prompt passes policy check." : `Blocked: ${r.reason}` }],
      structuredContent: result,
    };
  },
});
