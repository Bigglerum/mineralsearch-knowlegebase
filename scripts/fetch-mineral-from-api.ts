#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const MINDAT_API_KEY = process.env.MINDAT_API_KEY;

interface MindatApiResponse {
  id: number;
  name: string;
  ima_formula?: string;
  crystal_system?: string;
  hardness_min?: string;
  hardness_max?: string;
  streak?: string;
  colour?: string;
  [key: string]: any;
}

async function fetchMineralFromApi(mindatId: number) {
  console.log(`\n🔍 Fetching Mindat ID ${mindatId} from API...\n`);

  if (!MINDAT_API_KEY) {
    throw new Error('MINDAT_API_KEY not found in environment');
  }

  const url = `https://api.geomaterials.org/item/${mindatId}/?format=json`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Token ${MINDAT_API_KEY}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data: MindatApiResponse = await response.json();

  console.log('✅ Received data from API:');
  console.log(`   Name: ${data.name}`);
  console.log(`   Formula: ${data.ima_formula || '(empty)'}`);
  console.log(`   Crystal System: ${data.crystal_system || '(empty)'}`);
  console.log(`   Hardness: ${data.hardness_min || '?'} - ${data.hardness_max || '?'}`);
  console.log(`   Colour: ${data.colour || '(empty)'}`);
  console.log(`   Streak: ${data.streak || '(empty)'}\n`);

  return data;
}

async function updateNeonDatabase(mindatId: number, data: MindatApiResponse) {
  console.log('💾 Updating Neon database...\n');

  // Check if mineral exists
  const existing = await sql`
    SELECT id, mindat_id, name, ima_formula
    FROM mindat_minerals
    WHERE mindat_id = ${mindatId}
  `;

  if (existing.length === 0) {
    console.log(`❌ Mineral ${mindatId} not found in Neon database. Cannot update.`);
    return;
  }

  console.log(`Found existing record: ${existing[0].name} (DB ID: ${existing[0].id})`);
  console.log(`Current formula: ${existing[0].ima_formula || '(empty)'}\n`);

  // Update the record
  await sql`
    UPDATE mindat_minerals
    SET
      ima_formula = ${data.ima_formula || null},
      crystal_system = ${data.crystal_system || null},
      hardness_min = ${data.hardness_min || null},
      hardness_max = ${data.hardness_max || null},
      streak = ${data.streak || null},
      colour = ${data.colour || null}
    WHERE mindat_id = ${mindatId}
  `;

  console.log('✅ Updated Neon database\n');

  // Verify update
  const updated = await sql`
    SELECT name, ima_formula, crystal_system, hardness_min, hardness_max
    FROM mindat_minerals
    WHERE mindat_id = ${mindatId}
  `;

  console.log('Verified updated record:');
  console.log(JSON.stringify(updated[0], null, 2));
}

async function main() {
  const mindatId = parseInt(process.argv[2]);

  if (!mindatId || isNaN(mindatId)) {
    console.error('Usage: tsx scripts/fetch-mineral-from-api.ts <mindat_id>');
    console.error('Example: tsx scripts/fetch-mineral-from-api.ts 471053');
    process.exit(1);
  }

  try {
    const data = await fetchMineralFromApi(mindatId);
    await updateNeonDatabase(mindatId, data);
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
