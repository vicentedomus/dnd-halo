#!/usr/bin/env node
/**
 * wizard.mjs — Setup interactivo para configurar una nueva campaña.
 *
 * Uso:  node setup/wizard.mjs
 *
 * Genera campaign.js, inicializa la BD en Supabase y crea usuarios de auth.
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Helpers ─────────────────────────────────────────────────

function readSQL(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf-8');
}

function log(msg) { console.log(`  ${msg}`); }
function ok(msg)  { console.log(`  ✓ ${msg}`); }
function fail(msg){ console.log(`  ✗ ${msg}`); }

// ── Main ────────────────────────────────────────────────────

const rl = readline.createInterface({ input, output });

async function ask(question, defaultVal) {
  const suffix = defaultVal != null ? ` (${defaultVal})` : '';
  const answer = await rl.question(`  ${question}${suffix}: `);
  return answer.trim() || (defaultVal ?? '');
}

async function askYN(question, defaultNo = true) {
  const hint = defaultNo ? 's/N' : 'S/n';
  const answer = await rl.question(`  ${question} (${hint}): `);
  const a = answer.trim().toLowerCase();
  return defaultNo ? a === 's' || a === 'si' || a === 'y' || a === 'yes'
                   : a !== 'n' && a !== 'no';
}

console.log('\n  ⚔  D&D Campaign Setup  ⚔\n');

// Check if campaign.js already exists
const campaignPath = join(ROOT, 'campaign.js');
if (existsSync(campaignPath)) {
  const overwrite = await askYN('campaign.js ya existe. ¿Sobrescribir?');
  if (!overwrite) {
    log('Setup cancelado.');
    rl.close();
    process.exit(0);
  }
  console.log();
}

// ── Collect info ────────────────────────────────────────────

log('── Datos de la campaña ──\n');

const slug = await ask('Slug (sin espacios, ej: mi-campana)');
const name = await ask('Nombre de la campaña');
const subtitle = await ask('Subtítulo (opcional, Enter para saltar)', '');

console.log();
log('── Supabase ──\n');

const supabaseUrl = await ask('Project URL (https://XXXXX.supabase.co)');
const supabaseKey = await ask('Anon (public) key');
const serviceRoleKey = await ask('Service role key (solo para setup, no se guarda)');
const dbPassword = await ask('Database password');

console.log();
log('── Contraseñas de acceso ──\n');

const dmPassword = await ask('Contraseña del DM');
const playerPassword = await ask('Contraseña de los jugadores');

console.log();
log('── Opcionales ──\n');

const githubOwner = await ask('GitHub owner (Enter para saltar)', '');
const githubRepo = await ask('GitHub repo (Enter para saltar)', '');
const hasMap = await askYN('¿Tiene mapa SVG?');
const hasAI = await askYN('¿Tiene IA (Edge Functions + API key Anthropic)?');

rl.close();

// ── Extract Supabase ref ────────────────────────────────────

const refMatch = supabaseUrl.match(/https:\/\/(\w+)\.supabase\.co/);
if (!refMatch) {
  fail('URL de Supabase inválida. Debe ser https://XXXXX.supabase.co');
  process.exit(1);
}
const ref = refMatch[1];

// ── Step 1: Generate campaign.js ────────────────────────────

console.log('\n  ── Paso 1/3: Generando campaign.js...');

const campaignJS = `/**
 * campaign.js — Configuración de la campaña ${name}.
 * Este archivo NO se sube al repo (está en .gitignore).
 * Generado por setup/wizard.mjs
 */
const CAMPAIGN = {
  slug:           '${slug}',
  name:           '${name.replace(/'/g, "\\'")}',
  subtitle:       '${(subtitle || '').replace(/'/g, "\\'")}',
  supabaseUrl:    '${supabaseUrl}',
  supabaseKey:    '${supabaseKey}',
  githubOwner:    '${githubOwner}',
  githubRepo:     '${githubRepo}',
  hasMap:         ${hasMap},
  hasAI:          ${hasAI},
};
`;

writeFileSync(campaignPath, campaignJS, 'utf-8');
ok('campaign.js generado');

// ── Step 2: Initialize database ─────────────────────────────

console.log('\n  ── Paso 2/3: Inicializando base de datos...');

const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  ok('Conexión a Postgres establecida');
} catch (err) {
  fail(`No se pudo conectar a Postgres: ${err.message}`);
  log('Verifica el password de la BD y que el proyecto Supabase esté activo.');
  log('campaign.js ya se generó — puedes reintentar el wizard.');
  process.exit(1);
}

try {
  // Schema principal
  log('  → schema.sql...');
  await client.query(readSQL('sql/schema.sql'));
  ok('schema.sql');

  // Migraciones
  const migrationsDir = join(ROOT, 'sql/migraciones');
  const migrations = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const m of migrations) {
    log(`  → ${m}...`);
    await client.query(readFileSync(join(migrationsDir, m), 'utf-8'));
    ok(m);
  }

  // Catálogos
  log('  → items-catalog-schema.sql...');
  await client.query(readSQL('sql/items-catalog-schema.sql'));
  ok('items-catalog-schema.sql');

  log('  → monstruos-schema.sql...');
  await client.query(readSQL('sql/monstruos-schema.sql'));
  ok('monstruos-schema.sql');

  log('  → session-plans-schema.sql...');
  await client.query(readSQL('sql/session-plans-schema.sql'));
  ok('session-plans-schema.sql');

  // RLS
  log('  → rls.sql...');
  await client.query(readSQL('sql/rls.sql'));
  ok('rls.sql');

  // Migration tracking
  log('  → tabla _migrations...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    );
  `);
  for (const m of migrations) {
    await client.query(`INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, [m]);
  }
  ok('_migrations registradas');

} catch (err) {
  fail(`Error ejecutando SQL: ${err.message}`);
  log('La BD puede haber quedado parcialmente inicializada.');
  log('Revisa el error y vuelve a ejecutar el wizard (los CREATE IF NOT EXISTS son seguros).');
  await client.end();
  process.exit(1);
}

await client.end();
ok('Base de datos inicializada');

// ── Step 3: Create auth users ───────────────────────────────

console.log('\n  ── Paso 3/3: Creando usuarios...');

const users = [
  { email: `dm@${slug}.local`,     password: dmPassword,     role: 'dm' },
  { email: `player@${slug}.local`, password: playerPassword, role: 'player' },
];

for (const u of users) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      email:         u.email,
      password:      u.password,
      email_confirm: true,
      user_metadata: { role: u.role },
    }),
  });

  const data = await res.json();
  if (data.id) {
    ok(`${u.role.toUpperCase()} (${u.email})`);
  } else {
    fail(`Error creando ${u.role}: ${JSON.stringify(data)}`);
  }
}

// ── Done ────────────────────────────────────────────────────

console.log(`
  ────────────────────────────────
  ✓ Setup completo!

  DM:      ${dmPassword}
  Players: ${playerPassword}

  Abre index.html con Live Server
  o despliega a GitHub Pages.
  ────────────────────────────────
`);
