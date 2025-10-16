#!/usr/bin/env tsx

import { MindatAPIService } from '../server/services/mindat-api-service';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function updateMineralFromAPI(mindatId: number) {
  console.log(`\n🔍 Fetching Mindat ID ${mindatId} from API...\n`);

  const apiService = MindatAPIService.getInstance();

  try {
    const data = await apiService.getMineralById(mindatId);

    console.log('✅ Received data from API:');
    console.log(`   Name: ${data.name || '(empty)'}`);
    console.log(`   IMA Formula: ${data.ima_formula || '(empty)'}`);
    console.log(`   Mindat Formula: ${data.mindat_formula || '(empty)'}`);
    console.log(`   Crystal System: ${data.crystal_system || '(empty)'}`);
    console.log(`   Hardness: ${data.hardness_min || '?'} - ${data.hardness_max || '?'}\n`);

    // Update Neon database
    console.log('💾 Updating Neon database...\n');

    // Use mindat_formula if ima_formula is not available
    const formula = data.ima_formula || data.mindat_formula || null;
    console.log(`   Using formula: ${formula || '(none)'}\n`);

    await sql`
      UPDATE mindat_minerals
      SET
        ima_formula = ${formula},
        crystal_system = ${data.crystal_system || null},
        hardness_min = ${data.hardness_min || null},
        hardness_max = ${data.hardness_max || null},
        streak = ${data.streak || null},
        colour = ${data.colour || null}
      WHERE mindat_id = ${mindatId}
    `;

    console.log('✅ Updated Neon database\n');

    // Verify
    const result = await sql`
      SELECT name, ima_formula, crystal_system
      FROM mindat_minerals
      WHERE mindat_id = ${mindatId}
    `;

    console.log('Verified:', result[0]);
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

const mindatId = parseInt(process.argv[2]);
if (!mindatId || isNaN(mindatId)) {
  console.error('Usage: tsx scripts/update-mineral-from-api.ts <mindat_id>');
  process.exit(1);
}

updateMineralFromAPI(mindatId);
