#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL!);

async function check() {
  const ids = [52600, 43389, 52599];
  const result = await sql`SELECT mindat_id, name, entry_type, entry_type_text FROM mindat_minerals WHERE mindat_id = ANY(${ids})`;
  console.log(JSON.stringify(result, null, 2));
}

check();
