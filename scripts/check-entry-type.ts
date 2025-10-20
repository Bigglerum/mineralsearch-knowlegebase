#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL!);

async function check() {
  // Check Groups and Supergroups
  const groups = await sql`
    SELECT mindat_id, name, entry_type, entry_type_text
    FROM mindat_minerals
    WHERE name LIKE '%Group%' OR name LIKE '%Supergroup%'
    LIMIT 10
  `;
  console.log('Groups/Supergroups entry types:');
  console.log(JSON.stringify(groups, null, 2));

  // Check a normal mineral
  const mineral = await sql`SELECT mindat_id, name, entry_type, entry_type_text FROM mindat_minerals WHERE mindat_id = 54113`;
  console.log('\nAdanite (normal mineral):');
  console.log(JSON.stringify(mineral[0], null, 2));
}

check();
