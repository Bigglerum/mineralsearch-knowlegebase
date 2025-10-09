# E-Rocks Enrichment Implementation Status

**Last Updated:** 2025-10-08

## ✅ Completed

### 1. Core Matching Logic
- ✅ Strategy 1: Exact Mindat ID match (with IMA status filter)
- ✅ Strategy 2: Exact name match (with IMA status filter)
- ✅ Strategy 3: Normalized name variants (with IMA status filter)
- ✅ Strategy 4: Fuzzy name search (with IMA status filter)
- ✅ Strategy 5: Formula matching (with IMA status filter)

### 2. Data Processing Rules
- ✅ Variety/synonym parent matching logic
- ✅ Confidence-based review flags (100%, 95% auto-accept)
- ✅ UTF-8 character normalization (accents, Greek letters, subscripts)
- ✅ Chemical formula normalization
- ✅ IMA status filtering (APPROVED, PENDING, GRANDFATHERED, DISCREDITED, QUESTIONABLE)
- ✅ Use `searchName` for variety/synonym parent lookups

### 3. Documentation
- ✅ EROCKS_OBJECTIVES.md - Complete project objectives
- ✅ FIELD_MAPPING.md - e-Rocks ↔ Mindat field mapping
- ✅ EROCKS_ENRICHMENT_RULES.md - Matching rules
- ✅ config/erocks-exceptions.json - Exception file template

## ⚠️ TODO (Remaining Work)

### 1. Update `processCSV()` Method
**File:** `server/services/erocks-data-enrichment.ts:465`

**Changes Needed:**
```typescript
// Add filtering for Class="Mineral"
for (const record of records) {
  if (!this.shouldProcessRecord(record)) {
    skippedRecords.push(record);  // Non-minerals
    continue;
  }
  // ... existing matching logic
}

// Split results into 5 categories instead of 3
const matched = matches.filter(m => m.matchType !== 'no_match');
const needsReview = matched.filter(m => m.needsReview);  // NEW
const exceptions = matches.filter(m => m.matchType === 'no_match');  // RENAMED
const skipped = skippedRecords;  // NEW

// Generate 5 output files
await this.generateUpdateCSV(matched, path.join(outputDir, 'erocks_UPDATE.csv'));
await this.generateExceptionsCSV(exceptions, path.join(outputDir, 'erocks_EXCEPTIONS.csv'));
await this.generateSkippedCSV(skipped, path.join(outputDir, 'erocks_SKIPPED.csv'));
await this.generateNewMineralsCSV(matched, path.join(outputDir, 'mindat_NEW_MINERALS.csv'));
```

### 2. Rewrite `generateEnrichedCSV()` → `generateUpdateCSV()`
**File:** `server/services/erocks-data-enrichment.ts:568`

**Changes Needed:**
- Rename method to `generateUpdateCSV()`
- Use EXACT e-Rocks field names (not custom names)
- Implement Mindat-as-source-of-truth merge logic
- Only preserve: Nid, Created, Description
- Update all other fields from Mindat if available
- Add metadata columns at end

**Required Columns (in order):**
```typescript
const row = {
  // Original e-Rocks fields (exact names from CSV)
  'Published status': erocks['Published status'] || '',
  'Approval status': erocks['Approval status'] || '',
  'Created': erocks.Created || '',
  'Updated': new Date().toISOString(),  // Current timestamp
  'Title': mindat?.name || erocks.Title,  // Mindat wins
  'Strunz': mindat?.strunz_id || erocks.Strunz,  // Mindat wins
  'Formula': mindat?.formula || erocks.Formula,  // Mindat wins
  'Mindat ID': mindat?.mindat_id || erocks['Mindat ID'],
  'Class': 'Mineral',
  'Colour': mindat?.colour || erocks.Colour,  // Mindat wins
  'Crystal System': mindat?.crystal_system || erocks['Crystal System'],  // Mindat wins
  // ... all other e-Rocks fields with Mindat priority

  // NEW Metadata fields (append)
  'Match Type': match.matchType,
  'Match Confidence': match.confidence,
  'Needs Review': match.needsReview ? 'TRUE' : 'FALSE',
  'Is Variety': match.isVariety ? 'TRUE' : 'FALSE',
  'Is Synonym': match.isSynonym ? 'TRUE' : 'FALSE',
  'Parent Mineral': match.parentMineral || '',
  'Data Conflicts': match.conflicts.join(' | ')
};
```

### 3. Create `generateExceptionsCSV()` Method
**File:** `server/services/erocks-data-enrichment.ts` (new method)

- Same as e-Rocks original format
- Include all notes explaining why no match
- These stay in e-Rocks AS-IS

### 4. Create `generateSkippedCSV()` Method
**File:** `server/services/erocks-data-enrichment.ts` (new method)

- Records where Class != "Mineral"
- Just for reference/audit

### 5. Create `generateNewMineralsCSV()` Method
**File:** `server/services/erocks-data-enrichment.ts` (new method)

**Logic:**
```typescript
async generateNewMineralsCSV(matchedRecords: MatchResult[], outputPath: string) {
  // Get all Mindat IDs and names already in e-Rocks
  const eRocksIds = new Set(matchedRecords.map(m => m.erocksRecord['Mindat ID']).filter(Boolean));
  const eRocksNames = new Set(matchedRecords.map(m => m.erocksRecord.Title.toLowerCase()));

  // Query Mindat for NEW minerals
  const newMinerals = await this.sql`
    SELECT * FROM mindat_minerals
    WHERE ima_status IN ('APPROVED', 'PENDING PUBLICATION', 'GRANDFATHERED')
      AND mindat_id != ALL(${Array.from(eRocksIds)})
      AND LOWER(name) != ALL(${Array.from(eRocksNames)})
    ORDER BY name
  `;

  // Format for Drupal import (map Mindat fields to e-Rocks fields)
  // ...
}
```

### 6. Update Statistics Reporting
**File:** `server/services/erocks-data-enrichment.ts:585`

Add to stats:
- `skippedNonMinerals`
- `needsReviewCount`
- `newMindatMinerals`

## Testing Plan

### Phase 1: Sample Test (10 records)
```bash
# Create test CSV with 10 minerals
head -11 "/mnt/c/Users/halwh/Downloads/minerals (1).csv" > /tmp/test_sample.csv

# Run enrichment
npm run enrich-erocks /tmp/test_sample.csv ./test-output

# Verify 5 output files created
ls -la ./test-output/
```

### Phase 2: Full Run
```bash
npm run enrich-erocks "/mnt/c/Users/halwh/Downloads/minerals (1).csv" ./erocks-output
```

## Estimated Remaining Time

- Update processCSV: 10 min
- Rewrite generateUpdateCSV: 20 min
- Create 3 new generate methods: 15 min
- Testing & debugging: 15 min

**Total: ~60 minutes**

## Next Session Checklist

1. [ ] Complete processCSV filtering
2. [ ] Rewrite generateUpdateCSV with exact field names
3. [ ] Implement generateExceptionsCSV
4. [ ] Implement generateSkippedCSV
5. [ ] Implement generateNewMineralsCSV
6. [ ] Test on 10-record sample
7. [ ] Fix any bugs
8. [ ] Run on full dataset
9. [ ] Review output files
10. [ ] Commit working code
