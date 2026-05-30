---
name: Supabase edge function deploy limits
description: Hard constraints for mcpSupabase_deployEdgeFunction and the workaround pattern for multi-file edge functions.
---

## The Rule
`mcpSupabase_deployEdgeFunction` has two hard limits enforced by the MCP proxy schema:
- **Max 7 files** in the `files` array
- **Max ~14,600 total characters** across all file contents combined

Exceeding either limit throws `pid2 mcp proxy error message in requestData position did not match schema` (NOT a Supabase error — it never reaches Supabase).

`import_map_path` **must** be included for npm/jsr imports to resolve. Omitting it causes Supabase internal bundler errors.

## Why
The MCP proxy validates request payloads against a JSON schema before forwarding to Supabase. The schema caps array length and total string size. This is a Replit MCP proxy constraint, not a Supabase API constraint.

## How to Apply
When the edge function has more than 7 source files or >14KB total content:
1. Bundle all helper modules (services, models, utils, event handlers) into a single `lib/bundle.ts` that exports everything
2. Replace the verbose `lib/database.types.ts` with a compact single-line version (only the tables actually used)
3. Deploy with exactly 4 files: `index.ts`, `deno.json`, `lib/database.types.ts`, `lib/bundle.ts`
4. Always pass `import_map_path: 'deno.json'` in the deploy call

Target: total payload under 12KB to leave headroom.

## Pattern
```
deploy_edge_function({
  entrypoint_path: 'index.ts',
  import_map_path: 'deno.json',   // required
  files: [
    { name: 'index.ts', content: ... },           // thin entrypoint, imports from bundle
    { name: 'deno.json', content: ... },           // import map
    { name: 'lib/database.types.ts', content: ... }, // compact, single-line types
    { name: 'lib/bundle.ts', content: ... },       // everything else bundled here
  ]
})
```
