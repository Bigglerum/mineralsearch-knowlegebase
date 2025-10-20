#!/usr/bin/env tsx

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();
const sql = neon(process.env.DATABASE_URL!);

async function checkMineral() {
  const result = await sql`
    SELECT mindat_id, name, ima_formula
    FROM mindat_minerals
    WHERE name ILIKE '%Åsgruvanite%' OR name ILIKE '%Asgruvanite%'
  `;

  console.log('Found in Neon:');
  console.log(JSON.stringify(result, null, 2));
}

checkMineral();
