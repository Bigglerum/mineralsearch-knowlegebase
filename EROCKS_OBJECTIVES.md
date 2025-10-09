# E-Rocks Data Enrichment - Final Objectives

## Goal
Enrich e-Rocks mineral database with Mindat data while **preserving all existing content** to prevent orphaning.

## Input
- **e-Rocks CSV**: ~3,039 rows total
  - 2,387 with Class="Mineral"
  - 652 other types (Rock, Fossil, etc.)

## Output Files

### 1. `erocks_UPDATE.csv`
**Purpose**: Update existing e-Rocks minerals with enriched Mindat data

**Contents**:
- All e-Rocks minerals that matched to Mindat (ID, exact name, fuzzy, formula)
- Varieties matched to parent mineral
- Synonyms matched to canonical name

**Data Merge Rules**:
- Keep ALL original e-Rocks fields
- Only fill blank fields from Mindat
- If e-Rocks has data, DON'T overwrite
- Add new columns: `Mindat_*` fields for comparison
- Add metadata columns:
  - `Match_Type` (exact_id, exact_name, fuzzy_name, formula)
  - `Match_Confidence` (0-100)
  - `Needs_Review` (TRUE/FALSE)
  - `Is_Variety` (TRUE/FALSE)
  - `Is_Synonym` (TRUE/FALSE)
  - `Parent_Mineral` (if variety/synonym)
  - `Data_Conflicts` (list of field conflicts)

**Example Row**:
```
eRocks_Title, eRocks_Formula, eRocks_Crystal_System, Mindat_ID, Mindat_Formula, Mindat_Crystal_System, Match_Type, Match_Confidence, Needs_Review, Data_Conflicts
"Quartz", "", "Hexagonal", 3337, "SiO2", "Hexagonal", "exact_name", 95, FALSE, ""
"Amethyst", "", "", 3337, "SiO2", "Hexagonal", "exact_name", 95, FALSE, "Is variety of Quartz"
```

### 2. `mindat_NEW_MINERALS.csv`
**Purpose**: New approved minerals from Mindat NOT in e-Rocks (for bulk import)

**Query Logic**:
```sql
SELECT * FROM mindat_minerals
WHERE ima_status IN ('APPROVED', 'PENDING PUBLICATION', 'GRANDFATHERED')
  AND mindat_id NOT IN (
    -- All Mindat IDs already in e-Rocks CSV
  )
  AND name NOT IN (
    -- All mineral names already in e-Rocks CSV (case-insensitive)
  )
ORDER BY name
```

**Format**: Drupal-ready CSV for bulk import
- Mindat fields mapped to e-Rocks/Drupal fields
- Ready for Drupal importer

### 3. `erocks_EXCEPTIONS.csv`
**Purpose**: e-Rocks minerals that couldn't be matched to Mindat

**Contents**:
- Minerals with no Mindat ID
- Minerals where Mindat ID not found
- Minerals with name/formula that didn't match
- Low confidence matches (< 75%)

**Action**: KEEP AS-IS in e-Rocks, flag for manual review

**DO NOT DELETE THESE** - they may have dependent content!

### 4. `erocks_SKIPPED.csv`
**Purpose**: Non-mineral records skipped during processing

**Contents**:
- Class != "Mineral" (Rock, Fossil, Mineral Group, etc.)
- Kept for reference only

### 5. `match_report.json`
**Purpose**: Statistics and audit trail

```json
{
  "timestamp": "2025-10-08T...",
  "input": {
    "totalRecords": 3039,
    "minerals": 2387,
    "nonMinerals": 652
  },
  "matched": {
    "exactId": 1200,
    "exactName": 500,
    "fuzzyName": 300,
    "formula": 100,
    "total": 2100
  },
  "unmatched": 287,
  "needsReview": 400,
  "varieties": 150,
  "synonyms": 80,
  "newMindatMinerals": 3500,
  "conflicts": {
    "formula": 50,
    "crystalSystem": 30,
    "other": 20
  }
}
```

## Critical Rules

### DO NOT:
- ❌ Delete ANY e-Rocks records
- ❌ Overwrite existing e-Rocks data
- ❌ Remove unmatched minerals

### DO:
- ✅ Keep ALL e-Rocks minerals (matched or not)
- ✅ Only fill blank fields from Mindat
- ✅ Flag conflicts for manual review
- ✅ Match varieties to parent minerals
- ✅ Identify new Mindat minerals for import
- ✅ Preserve content relationships (prevent orphans)

## Implementation Steps

1. **Load e-Rocks CSV** and filter to Class="Mineral"
2. **Match each e-Rocks mineral** to Mindat database
3. **Merge data** (only fill blanks, preserve e-Rocks data)
4. **Identify new Mindat minerals** not in e-Rocks
5. **Generate 5 output files** as specified above
6. **Review statistics** before importing

## Success Criteria

- ✅ All 2,387 e-Rocks minerals accounted for (UPDATE or EXCEPTIONS)
- ✅ No data loss from e-Rocks
- ✅ ~3,500 new Mindat minerals identified
- ✅ Clear review flags for low confidence matches
- ✅ Safe to import without breaking content relationships
