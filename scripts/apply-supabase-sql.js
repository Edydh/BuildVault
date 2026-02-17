#!/usr/bin/env node

/*
 * Applies a SQL file to a Supabase project using the Supabase Management API.
 *
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_ACCESS_TOKEN (or SUPABASE_MANAGEMENT_TOKEN)
 *
 * Optional:
 * - SUPABASE_PROJECT_REF (auto-derived from SUPABASE_URL if omitted)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function deriveProjectRefFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || '';
    return host.split('.')[0] || null;
  } catch {
    return null;
  }
}

function applySql({ projectRef, accessToken, sql }) {
  const payload = JSON.stringify({ query: sql });
  const options = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk.toString();
      });
      res.on('end', () => {
        const statusCode = res.statusCode || 0;
        if (statusCode >= 200 && statusCode < 300) {
          resolve({ statusCode, body });
          return;
        }
        reject(
          new Error(
            `Supabase Management API failed (${statusCode}). Response: ${body.slice(0, 1000)}`
          )
        );
      });
    });

    req.on('error', (error) => reject(error));
    req.write(payload);
    req.end();
  });
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, '.env'));

  const sqlArg = process.argv[2];
  if (!sqlArg) {
    console.error(
      'Usage: node scripts/apply-supabase-sql.js <sql-file-path>\n' +
        'Example: node scripts/apply-supabase-sql.js supabase/migrations/20260217_0001_collaboration_foundation.sql'
    );
    process.exit(1);
  }

  const sqlPath = path.resolve(cwd, sqlArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN || null;
  const projectRef = process.env.SUPABASE_PROJECT_REF || deriveProjectRefFromUrl(supabaseUrl || '');

  if (!supabaseUrl) {
    console.error('Missing SUPABASE_URL in environment.');
    process.exit(1);
  }
  if (!projectRef) {
    console.error('Could not derive project ref. Set SUPABASE_PROJECT_REF in environment.');
    process.exit(1);
  }
  if (!accessToken) {
    console.error(
      'Missing SUPABASE_ACCESS_TOKEN (or SUPABASE_MANAGEMENT_TOKEN) in environment.\n' +
        'Create one in Supabase Dashboard > Account > Access Tokens.'
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  if (!sql.trim()) {
    console.error(`SQL file is empty: ${sqlPath}`);
    process.exit(1);
  }

  console.log(`Applying migration to Supabase project: ${projectRef}`);
  const result = await applySql({ projectRef, accessToken, sql });
  console.log(`Success (${result.statusCode}).`);
}

main().catch((error) => {
  console.error('Failed to apply SQL migration.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
