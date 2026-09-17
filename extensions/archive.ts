import archive, { openDb, syncSessionFile } from "@gordonb/pi-archive/extensions/archive.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Scope the upstream indexer's startup discovery to this application's workspace.
// Its search tool, turn indexing, schema, and shutdown implementation are unchanged.
export default function (pi: ExtensionAPI) {
  archive(new Proxy(pi, { get(target, key) {
    if (key === "on") return (event: string, handler: any) => {
      if (event !== "session_start") target.on(event as any, handler);
    };
    return Reflect.get(target, key);
  } }));
  let db: ReturnType<typeof openDb> | undefined;
  pi.on("session_start", (_event, ctx) => {
    db = openDb(join(ctx.cwd, ".pi/archive.db"));
    const root = ctx.sessionManager.getSessionDir();
    if (existsSync(root)) for (const file of readdirSync(root)) {
      if (file.endsWith(".jsonl")) syncSessionFile(db, join(root, file));
    }
  });
  pi.on("session_shutdown", () => { db?.close(); db = undefined; });
}
