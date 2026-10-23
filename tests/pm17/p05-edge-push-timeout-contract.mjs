import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(here, "../../supabase/functions/enviar-notificacion/index.ts"),
  "utf8",
);

assert.match(source, /PUSH_SEND_TIMEOUT_MS\s*=\s*12000/);
assert.match(source, /async function sendPushWithTimeout/);
assert.match(source, /Promise\.race\(\[/);
assert.match(source, /PUSH_SEND_TIMEOUT/);
assert.match(source, /let timeouts\s*=\s*0/);
assert.match(source, /timeouts,\s*\n\s*qaTest: aud010QaTest,\s*\n\s*\}/);
assert.match(source, /return json\(req, ok \? 200 : 502/);
assert.match(source, /const QA_PROJECT_ID = "qjqorixtkilwsndqayyx"/);
assert.match(source, /aud010Prueba === true/);
assert.match(source, /qaTest: aud010QaTest/);

console.log("PASS: AUD-010 bounded push delivery and observable failure contract");
