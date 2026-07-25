#!/usr/bin/env node
/* Fold the built JS and CSS into index.html, producing a single file.
 *
 * Runs automatically after `vite build`. The motivation is reliability
 * rather than size: a separate bundle request that fails (blocked, 404,
 * dropped mid-flight) leaves the page loaded but the app dead. With one
 * file there is nothing left to fail independently.
 */

import { readFile, writeFile, readdir, copyFile } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const htmlPath = join(dist, "index.html");

if (!existsSync(htmlPath)) {
  console.error("inline-build: dist/index.html not found — run vite build first");
  process.exit(1);
}

let html = await readFile(htmlPath, "utf8");

// A bundle can legally contain the characters "</script>", which would end
// the inline tag early. Break the sequence without changing the code.
const escapeForInline = (code) => code.replace(/<\/script>/gi, "<\\/script>");

let inlinedJs = 0;
let inlinedCss = 0;

// Replacements are passed as functions on purpose: with a string, `$&`,
// `$'` and friends are interpreted as substitution patterns, and minified
// React genuinely contains "$&" — which silently splices the matched tag
// into the middle of the bundle.
// <script ... src="./assets/x.js"></script>  ->  inline <script> at end of body.
//
// Position matters: Vite puts the bundle in <head>, which is fine while it's
// a deferred module script. Inlined as a classic script it would run before
// #root exists, so React would have nothing to mount into. Move it to just
// before </body> instead.
const scriptTag = /<script\b[^>]*\bsrc=["']\.?\/?(assets\/[^"']+\.js)["'][^>]*><\/script>/gi;
const deferred = [];
for (const match of [...html.matchAll(scriptTag)]) {
  const [tag, relPath] = match;
  const code = escapeForInline(await readFile(join(dist, relPath), "utf8"));
  html = html.replace(tag, () => "");
  // The id lets the loading screen find this code and re-run it if the
  // first execution didn't take.
  deferred.push(`<script id="app-bundle">${code}</script>`);
  inlinedJs++;
}
if (deferred.length) {
  const body = deferred.join("\n");
  if (!/<\/body>/i.test(html)) {
    console.error("inline-build: no </body> to place the app script before");
    process.exit(1);
  }
  html = html.replace(/<\/body>/i, () => `${body}\n</body>`);
}

// <link rel="stylesheet" href="./assets/x.css">  ->  <style>…</style>
const styleTag = /<link\b[^>]*\bhref=["']\.?\/?(assets\/[^"']+\.css)["'][^>]*>/gi;
for (const match of [...html.matchAll(styleTag)]) {
  const [tag, relPath] = match;
  const css = (await readFile(join(dist, relPath), "utf8")).replace(/<\/style>/gi, "<\\/style>");
  html = html.replace(tag, () => `<style id="app-style">${css}</style>`);
  inlinedCss++;
}

// Preload hints for files that no longer exist would just 404.
html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, "");

// Nothing may still point at a bundle file, and no inlined code may carry a
// literal </script> that would end its own tag early. Either would ship a
// dead page, so fail the build rather than deploy it.
if (new RegExp(scriptTag.source, "i").test(html) || new RegExp(styleTag.source, "i").test(html)) {
  console.error("inline-build: a bundle reference survived inlining — refusing to write");
  process.exit(1);
}
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (inlineScripts.some((m) => m[1].includes("</script>"))) {
  console.error("inline-build: inlined code contains a literal </script> — refusing to write");
  process.exit(1);
}
// A "<!--" inside a script switches the HTML tokenizer into escaped mode,
// where a later "<script" can stop </script> from closing the element.
if (inlineScripts.some((m) => m[1].includes("<!--") && /<script/i.test(m[1]))) {
  console.error("inline-build: inlined code mixes <!-- and <script — refusing to write");
  process.exit(1);
}

await writeFile(htmlPath, html, "utf8");

// The files in assets/ are deliberately kept even though nothing links to
// them. Some networks and devices strip large inline <script>/<style>
// blocks; when that happens the loading screen falls back to loading these
// as ordinary files. Two delivery routes, one of which usually survives.
const assetsDir = join(dist, "assets");
if (existsSync(assetsDir)) {
  const kept = await readdir(assetsDir);
  // Third route: byte-identical copies under a neutral extension. Some
  // filters block by URL pattern (anything ending .js/.css) rather than by
  // content, and these slip through where the originals do not.
  for (const [from, to] of [
    ["index.js", "app.txt"],
    ["style.css", "app-style.txt"],
  ]) {
    if (existsSync(join(assetsDir, from))) {
      await copyFile(join(assetsDir, from), join(assetsDir, to));
    }
  }
  console.log(`inline-build: kept assets/ as fallbacks (${kept.join(", ")} + .txt copies)`);
}

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`inline-build: inlined ${inlinedJs} script(s), ${inlinedCss} stylesheet(s) → index.html ${kb} kB`);

if (inlinedJs === 0) {
  console.error("inline-build: no script was inlined — the app would not start");
  process.exit(1);
}
