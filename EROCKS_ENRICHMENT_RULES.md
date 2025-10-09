# E-Rocks Data Enrichment Rules

## Implementation Status: IN PROGRESS

### Rules Implemented ✅

1. **e-Rocks Filtering**
   - ✅ Only process records where `Class = "Mineral"` (2,387 of 3,039 records)
   - ✅ Skip Rock, Mineral Group, Fossil, Man Made, etc.

2. **Mindat IMA Status Filtering**
   - ✅ Only match against approved minerals with IMA status:
     - APPROVED
     - PENDING PUBLICATION
     - GRANDFATHERED
     - DISCREDITED (with link to replacement)
     - QUESTIONABLE (flagged for review)

3. **Variety/Synonym Handling**
   - ✅ Match parent mineral when "Variety Of" is populated
   - ✅ Match parent mineral when "Synonym Of" is populated
   - ✅ Flag record as `isVariety` or `isSynonym`
   - ✅ Store parent mineral name in result

4. **Confidence-Based Review Flags**
   - ✅ 100% (Exact ID match) → Always accept (`needsReview = false`)
   - ✅ 95% (Exact name match) → Always accept (`needsReview = false`)
   - ✅ 75-94% (Fuzzy/Formula) → Flag for review (`needsReview = true`)

5. **Exceptions File**
   - ✅ Created `/config/erocks-exceptions.json` for manual overrides

### Still TODO ⚠️

1. **Add IMA Status Filter to ALL queries** (Strategy 3, 4, 5)
   - Strategy 3 (Normalized variants) - PARTIAL
   - Strategy 4 (Fuzzy search) - NOT DONE
   - Strategy 5 (Formula match) - NOT DONE

2. **Use `searchName` consistently**
   - Currently uses `title` in some places instead of `searchName`
   - Need to use parent name for variety/synonym searches

3. **Add needsReview flag to all match types**
   - Fuzzy matches (confidence < 95%) should set `needsReview = true`
   - Formula matches should set `needsReview = true`

4. **Load and apply exceptions file**
   - Read `/config/erocks-exceptions.json`
   - Skip records with `action: "skip"`
   - Override matches with `preferredMatch`

5. **Update processCSV to filter input**
   - Call `shouldProcessRecord()` before processing
   - Skip non-Mineral records
   - Track statistics for filtered records

6. **Update output CSV columns**
   - Add `needsReview` column
   - Add `isVariety` column
   - Add `isSynonym` column
   - Add `parentMineral` column

## Matching Strategy Summary

### Priority Order:
1. **Exact Mindat ID** (100% confidence) → Auto-accept
2. **Exact Name Match** (95% confidence) → Auto-accept
   - Uses parent name if variety/synonym
3. **Normalized Name Variants** (88% confidence) → Review
4. **Fuzzy Name Match** (80-94% confidence) → Review
5. **Formula Match** (75-80% confidence) → Review

### Output Files:
- `erocks_enriched_clean.csv` - All matched (100% + 95% confidence)
- `erocks_needs_review.csv` - Matched but needs review (75-94% confidence)
- `erocks_unmatched.csv` - No match found
- `erocks_conflicts.csv` - Data conflicts detected
- `erocks_skipped.csv` - Non-minerals and exceptions
- `match_report.json` - Statistics

## Next Steps

Run this command when ready to test:
```bash
npm run enrich-erocks "/mnt/c/Users/halwh/Downloads/minerals (1).csv" ./erocks-output
```

Expected results:
- ~2,387 Minerals processed
- ~650 non-minerals skipped
- Match rate: TBD (likely 60-80%)
