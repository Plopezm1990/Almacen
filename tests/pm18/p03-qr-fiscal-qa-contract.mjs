import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const migration = readFileSync(
  resolve(root, 'supabase/migrations/20261026160000_abc_p18_qa_fiscal_qr_ticket.sql'),
  'utf8',
);

const required = [
  "p_empresa_id<>'QA-EMP-A'",
  "p_local_id<>'QA-A1'",
  "raise exception 'qr_fiscal_qa_only'",
  "'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif='",
  "'nif'",
  "'numserie'",
  "'fecha'",
  "'importe'",
  "'PRUEBAS_EXTERNAS'",
  "'PREPARADO_SIMULADOR'",
  "extensions.digest",
  "unique (empresa_id,local_id,operation_id)",
  "unique (empresa_id,local_id,venta_fiscal_id)",
  "unique (empresa_id,local_id,documento_id)",
  'alter table public.abc_fiscal_qr_documentos enable row level security',
  'grant select on table public.abc_fiscal_qr_documentos to authenticated',
  'revoke all on function public.abc_preparar_ticket_fiscal_qa',
];

for (const fragment of required) {
  if (!migration.includes(fragment)) {
    throw new Error(`Falta contrato QR fiscal QA: ${fragment}`);
  }
}

if (migration.includes('formato=json')) {
  throw new Error('El QR no debe incluir formato=json en la URL');
}

if (!migration.includes("'aeat_presentacion',false")) {
  throw new Error('El resultado debe declarar que no hubo presentación AEAT');
}

console.log('PASS: contrato QR fiscal QA P18');
