import type { ToolDef } from "./protocol";
import { MCP_TOOLS } from "./tools";
import { WRITE_TOOLS } from "./tools-write";

/** Every tool of the MCP plug: lot 1 (reading), then lot 2 (reversible actions). */
export const ALL_TOOLS: readonly ToolDef[] = [...MCP_TOOLS, ...WRITE_TOOLS];
export { MCP_TOOLS as READ_TOOLS, WRITE_TOOLS };
