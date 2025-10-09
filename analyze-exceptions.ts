import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeExceptions() {
  const sql = neon(process.env.DATABASE_URL!);

  // Get all IMA statuses in the database
  const allStatuses = await sql`
    SELECT ima_status, COUNT(*) as count
    FROM mindat_minerals
    GROUP BY ima_status
    ORDER BY count DESC
  `;

  console.log('\n📊 All IMA Statuses in Mindat Database:\n');
  allStatuses.forEach(r => {
    console.log(`   ${r.ima_status}: ${r.count} minerals`);
  });

  // Check specific exception minerals
  const sampleIds = [754, 181, 3805];
  console.log('\n🔍 Sample Exception Minerals:\n');

  for (const id of sampleIds) {
    const result = await sql`
      SELECT name, ima_status
      FROM mindat_minerals
      WHERE mindat_id = ${id}
    `;
    if (result.length > 0) {
      console.log(`   ${id}: ${result[0].name} (${result[0].ima_status})`);
    }
  }
}

analyzeExceptions();
