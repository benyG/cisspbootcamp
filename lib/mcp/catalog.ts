import type { ToolDef } from "./protocol";
import { MCP_TOOLS } from "./tools";
import { REQUEST_TOOLS } from "./tools-request";
import { WRITE_TOOLS } from "./tools-write";

/** Every tool of the MCP plug: lot 1 (reading), lot 2 (reversible actions), lot 3 (requests Ben validates). */
export const ALL_TOOLS: readonly ToolDef[] = [...MCP_TOOLS, ...WRITE_TOOLS, ...REQUEST_TOOLS];
export { MCP_TOOLS as READ_TOOLS, REQUEST_TOOLS, WRITE_TOOLS };
