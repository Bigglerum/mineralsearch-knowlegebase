#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL!);

const result = await sql`SELECT mindat_id, name, strunz10ed1, strunz10ed2, strunz10ed3, strunz10ed4 FROM mindat_minerals WHERE mindat_id = 472206`;
console.log(JSON.stringify(result[0], null, 2));
