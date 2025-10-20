#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function checkMineral() {
  console.log('Checking Mindat ID 471053 in Neon database...\n');

  const result = await sql`
    SELECT id, mindat_id, name, ima_formula, long_id
    FROM mindat_minerals
    WHERE mindat_id = 471053
  `;

  if (result.length === 0) {
    console.log('❌ No mineral found with Mindat ID 471053');
  } else {
    console.log('✅ Found mineral:');
    console.log(JSON.stringify(result[0], null, 2));
  }
}

checkMineral().catch(console.error);
