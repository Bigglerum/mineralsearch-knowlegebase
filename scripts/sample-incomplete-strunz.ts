#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function getSamples() {
  const results = await sql`
    SELECT
      mindat_id,
      name,
      strunz10ed1,
      strunz10ed2,
      strunz10ed3,
      strunz10ed4,
      CONCAT_WS('.',
        strunz10ed1,
        CASE
          WHEN strunz10ed2 IS NOT NULL AND strunz10ed3 IS NOT NULL
          THEN strunz10ed2 || strunz10ed3
          WHEN strunz10ed2 IS NOT NULL
          THEN strunz10ed2
          ELSE NULL
        END,
        strunz10ed4
      ) as current_strunz
    FROM mindat_minerals
    WHERE
      name NOT ILIKE '%Group%'
      AND strunz10ed1 IS NOT NULL
      AND strunz10ed1 != ''
      AND strunz10ed2 IS NOT NULL
      AND strunz10ed2 != ''
      AND strunz10ed3 IS NOT NULL
      AND strunz10ed3 != ''
      AND (strunz10ed4 IS NULL OR strunz10ed4 = '')
    ORDER BY name
    LIMIT 20
  `;

  console.log('Sample of 20 minerals with incomplete Strunz:\n');
  results.forEach((r: any) => {
    console.log(`${r.mindat_id.toString().padEnd(8)} | ${r.name.padEnd(40)} | ${r.current_strunz.padEnd(10)} | [${r.strunz10ed1}] [${r.strunz10ed2}] [${r.strunz10ed3}] [${r.strunz10ed4 || 'NULL'}]`);
  });
}

getSamples();
