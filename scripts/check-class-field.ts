#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL!);

async function check() {
  // Check if there's a class or type column
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'mindat_minerals' AND (column_name LIKE '%class%' OR column_name LIKE '%type%')`;
  console.log('Columns with class/type:', JSON.stringify(cols, null, 2));

  // Check a Group record
  const group = await sql`SELECT mindat_id, name, mindat_longid FROM mindat_minerals WHERE mindat_id = 52600 LIMIT 1`;
  console.log('\nAlnaperbøeite Group data:', JSON.stringify(group[0], null, 2));
}

check();
