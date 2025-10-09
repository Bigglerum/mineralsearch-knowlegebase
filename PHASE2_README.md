# Phase 2: Relationship Resolver - Complete Implementation

## Overview
Phase 2 resolves Mindat relationship data to e-Rocks entity references (Nids) for import into Drupal.

## What It Does

1. **Loads e-Rocks CSV** (post Phase 1 import)
   - Builds Mindat ID → e-Rocks Nid lookup table
   - Ensures all minerals (including newly imported) are mapped

2. **Queries Mindat for relationships**
   - `variety_of` - Parent mineral for varieties
   - `group_id` - Group membership
   - `syn_id` - Synonym parent
   - `polytype_of` - Polytype parent

3. **Resolves to e-Rocks Nids**
   - Converts Mindat IDs to e-Rocks Nids
   - Handles missing mappings gracefully
   - Provides display names for review

4. **Generates CSV for import**
   - Columns with Nids for Drupal entity references
   - Columns with names for human review
   - Resolution notes for troubleshooting

## Prerequisites

✅ Phase 1 completed
✅ Phase 1 outputs (`erocks_UPDATE.csv` + `mindat_NEW_MINERALS.csv`) imported into Drupal
✅ Fresh e-Rocks CSV exported with **all minerals including newly imported ones**
✅ **All minerals must have Nids** in the CSV

## Usage

```bash
npm run resolve-relationships <input-csv> <output-directory>
```

### Example:
```bash
npm run resolve-relationships /path/to/minerals-with-nids.csv /output/phase2
```

## Input CSV Requirements

The input CSV **MUST** include these columns:
- `Nid` - e-Rocks node ID (required for all minerals)
- `Title` - Mineral name
- `Mindat ID` - Mindat database ID

Example:
```csv
Nid,Title,Mindat ID,...
9375,Allanite Group,46220,...
2349626,Ferriallanite-(Ce),11433,...
```

## Output Files

### 1. `erocks_RELATIONSHIPS.csv`
Main output for Drupal import.

**Columns:**
- `Nid` - e-Rocks node ID to update
- `Variety Of` - Nid of parent mineral (for entity reference)
- `Group Parent` - Nid of group (for entity reference)
- `Synonym Of` - Nid of synonym parent (for entity reference)
- `Polytype Of` - Nid of polytype parent (for entity reference)
- `Variety Of Name` - Display name (for review)
- `Group Parent Name` - Display name (for review)
- `Synonym Of Name` - Display name (for review)
- `Polytype Of Name` - Display name (for review)
- `Resolution Notes` - Warnings about missing mappings

**Example row:**
```csv
Nid,Variety Of,Group Parent,Synonym Of,Polytype Of,Variety Of Name,Group Parent Name,...
2349626,,9375,,,Allanite Group,...
```

### 2. `relationship_report.json`
Statistics about the resolution process.

```json
{
  "totalMappings": 1234,
  "timestamp": "2025-10-08T15:00:00.000Z"
}
```

## Drupal Import Mapping

When importing `erocks_RELATIONSHIPS.csv` into Drupal:

1. **Map Nid column** → Use as unique identifier
2. **Map relationship Nid columns** → Entity reference fields:
   - `Variety Of` → Variety Of field
   - `Group Parent` → Group Parent field
   - `Synonym Of` → Synonym Of field
   - `Polytype Of` → Polytype Of field
3. **Ignore display name columns** → Just for human review
4. **Review Resolution Notes** → Check for missing mappings

## How It Works

### 1. Build Lookup Table
```typescript
{
  46220 => "9375",  // Allanite Group
  11433 => "2349626", // Ferriallanite-(Ce)
  ...
}
```

### 2. For Each Mineral with Mindat ID:

```typescript
// Query Mindat
SELECT variety_of, group_id, syn_id, polytype_of
FROM mindat_minerals
WHERE mindat_id = 11433
// Returns: { variety_of: null, group_id: 46220, syn_id: null, polytype_of: null }

// Resolve to e-Rocks Nids
group_id 46220 → lookup table → e-Rocks Nid "9375"

// Output row:
{
  Nid: "2349626",
  Group Parent: "9375",
  Group Parent Name: "Allanite Group"
}
```

### 3. Write CSV
All minerals with resolved relationships ready for Drupal import.

## Handling Missing Mappings

If a Mindat relationship points to a mineral **not in e-Rocks**:
- Nid column left empty
- Name column shows the mineral name from Mindat
- Resolution Notes includes warning

**Example:**
```csv
Nid,Variety Of,Variety Of Name,Resolution Notes
1234,,Unknown Mineral,"Variety of Mindat ID 99999 not found in e-Rocks"
```

**Action:** Review these manually - may need to import the missing mineral first.

## Testing

Use the current e-Rocks CSV to test (even before Phase 1 import):
```bash
npm run resolve-relationships /mnt/c/Users/halwh/Downloads/minerals\ \(1\).csv /tmp/phase2-test
```

This will:
- Build lookup from existing data
- Resolve relationships for minerals that already have Mindat IDs
- Show how Phase 2 will work with full dataset

## Error Handling

- **Missing Nid**: Mineral skipped (needs Nid for entity reference)
- **Missing Mindat ID**: Mineral skipped (can't query relationships)
- **Mindat query fails**: Returns empty relationships, logs error
- **Relationship not found in e-Rocks**: Empty Nid, note in Resolution Notes

## Next Steps After Running Phase 2

1. ✅ Review `erocks_RELATIONSHIPS.csv`
2. ✅ Check Resolution Notes for missing mappings
3. ✅ Import CSV into Drupal
4. ✅ Verify entity references work correctly:
   - Visit mineral page
   - Check Group Parent links to correct group
   - Check Variety Of links to parent mineral
5. ✅ For missing mappings, consider:
   - Import missing minerals first
   - Re-run Phase 2
   - Or manually populate relationships

## Performance

- **~9,000 minerals**: ~2-3 minutes (depends on database latency)
- **Progress indicator**: Shows every 100 minerals processed
- **Memory efficient**: Streams CSV, doesn't load all in memory at once

## Files Created

- `/server/services/erocks-relationship-resolver.ts` - Core service
- `/scripts/resolve-relationships.ts` - Executable script
- `PHASE2_README.md` - This file
- Updated `package.json` with `resolve-relationships` command

## Architecture

```
┌─────────────────────────────────────┐
│ e-Rocks CSV (with Nids)            │
│ - Existing minerals                 │
│ - Newly imported from Phase 1       │
└──────────┬──────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Build Mindat ID → Nid Lookup        │
│ Map: { mindatId: erocksNid }        │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ For Each Mineral with Mindat ID:    │
│ 1. Query Mindat relationships        │
│ 2. Resolve IDs → Nids via lookup     │
│ 3. Build output row                  │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ Output: erocks_RELATIONSHIPS.csv     │
│ - Nid + relationship Nid fields      │
│ - Display names for review           │
│ - Resolution notes                   │
└──────────────────────────────────────┘
```

## Status

✅ **Fully implemented and ready to use**

Waiting on:
- Phase 1 to complete on production data
- Phase 1 outputs to be imported into Drupal
- Fresh e-Rocks CSV export with all Nids

Then Phase 2 can run to populate all relationships!
