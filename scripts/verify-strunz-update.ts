#!/usr/bin/env tsx
/**
 * Verify Strunz placeholder updates in Neon database
 */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function verifyUpdate() {
  console.log('=== Neon Database Verification ===\n');

  // Check for minerals with .x placeholder
  const withX = await sql`
    SELECT COUNT(*) as count
    FROM mindat_minerals
    WHERE strunz10ed4 = 'x'
  `;

  // Get some examples
  const examples = await sql`
    SELECT
      mindat_id,
      name,
      strunz10ed1,
      strunz10ed2,
      strunz10ed3,
      strunz10ed4
    FROM mindat_minerals
    WHERE strunz10ed4 = 'x'
    ORDER BY name
    LIMIT 10
  `;

  // Check for any remaining 3-part classifications without x
  const remaining = await sql`
    SELECT COUNT(*) as count
    FROM mindat_minerals
    WHERE strunz10ed1 IS NOT NULL
      AND strunz10ed1 != '' AND strunz10ed1 != '0'
      AND strunz10ed2 IS NOT NULL
      AND strunz10ed2 != '' AND strunz10ed2 != '0'
      AND strunz10ed3 IS NOT NULL
      AND strunz10ed3 != '' AND strunz10ed3 != '0'
      AND (strunz10ed4 IS NULL OR strunz10ed4 = '')
      AND name NOT ILIKE '%group%'
  `;

  console.log(`✓ Minerals with .x placeholder: ${withX[0].count}`);
  console.log(`✓ Remaining 3-part without .x: ${remaining[0].count}\n`);

  if (examples.length > 0) {
    console.log('Sample minerals with .x:');
    examples.forEach(m => {
      console.log(`  ${m.name}: ${m.strunz10ed1}.${m.strunz10ed2}.${m.strunz10ed3}.${m.strunz10ed4}`);
    });
  }

  console.log('\n✓ Database verification complete!');
}

verifyUpdate().catch(console.error);
