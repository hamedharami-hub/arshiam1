import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import accessHandler from "./assistant-access/index.js";

function functionsIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith("_")) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? functionsIn(path) : /\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name) ? [path] : [];
  });
}
it("fits Vercel Hobby and preserves public OAuth and revoke URLs with rewrites", () => {
  expect(functionsIn(__dirname)).toHaveLength(12);
  const config = JSON.parse(readFileSync(resolve(__dirname, "../vercel.json"), "utf8"));
  expect(config.rewrites).toEqual(expect.arrayContaining([
    { source: "/api/oauth", destination: "/api/mcp" },
    { source: "/api/assistant-access/:id", destination: "/api/assistant-access?id=:id" },
    { source: "/.well-known/oauth-protected-resource", destination: "/api/mcp?action=resource" },
  ]));
});
it("requires owner authentication on the consolidated revoke route", async () => {
  let status = 0, body = "";
  await accessHandler({ method: "DELETE", query: { id: "a".repeat(32) }, headers: {} }, {
    setHeader() {}, set statusCode(code: number) { status = code; }, end(value: string) { body = value; },
  });
  expect(status).toBe(401);
  expect(JSON.parse(body).error.code).toBe("UNAUTHORIZED");
});
