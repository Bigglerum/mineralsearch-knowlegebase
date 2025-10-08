// Simple script to trigger Mindat CSV import
const filePath = process.argv[2] || '/mnt/c/Users/halwh/Downloads/mindatdump.csv';

console.log('Triggering Mindat CSV import...');
console.log('File:', filePath);

fetch('http://localhost:5000/api/mindat-csv/import', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    filePath: filePath,
    batchSize: 50,
    skipExisting: false
  })
})
.then(res => res.json())
.then(data => {
  console.log('Import result:', JSON.stringify(data, null, 2));
})
.catch(err => {
  console.error('Error:', err.message);
});

console.log('Import request sent. Check server logs for progress...');
