#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL!);

async function check() {
  const ids = [75, 53044, 52600];
  const result = await sql`SELECT mindat_id, name, strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4 FROM mindat_minerals WHERE mindat_id = ANY(${ids})`;
  console.log(JSON.stringify(result, null, 2));
}

check();
