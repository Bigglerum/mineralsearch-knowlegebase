// Script to sync new minerals from Mindat API
// Usage: node sync-new-minerals.js [startId] [endId]

const startId = parseInt(process.argv[2]) || undefined;
const endId = parseInt(process.argv[3]) || undefined;

console.log('🔄 Starting Mindat incremental sync...');
if (startId) {
  console.log(`Starting from mineral ID: ${startId}`);
}
if (endId) {
  console.log(`Ending at mineral ID: ${endId}`);
}

fetch('http://localhost:5000/api/mindat/sync/incremental', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    startId,
    endId,
    batchSize: 100,
  })
})
.then(res => res.json())
.then(data => {
  console.log('\n✅ Sync completed!');
  console.log('================');
  console.log(`Total checked: ${data.totalChecked}`);
  console.log(`New minerals: ${data.newMinerals}`);
  console.log(`Updated minerals: ${data.updatedMinerals}`);
  console.log(`Deleted minerals: ${data.deletedMinerals}`);

  if (data.errors && data.errors.length > 0) {
    console.log(`\n❌ Errors (${data.errors.length}):`);
    data.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }

  process.exit(0);
})
.catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

console.log('\n⏳ Sync running in background. Check server logs for progress...\n');
