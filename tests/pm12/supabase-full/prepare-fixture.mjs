import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const target = join(here, 'supabase', 'migrations');
for (const name of [
  '20260904135838_pm07_stock_ubicacion_y_reversos.sql',
  '20260907155028_pm12_p08_stock_atomico.sql'
]) {
  copyFileSync(join(repo, 'supabase', 'migrations', name), join(target, name));
}
console.log('PM12_P08_EXACT_MIGRATIONS_COPIED=PASS');
