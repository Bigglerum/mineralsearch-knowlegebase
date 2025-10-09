# E-Rocks Data Enrichment: Two-Phase Process

## Overview

The e-Rocks data enrichment is designed as a **two-phase process** to ensure data integrity and handle entity references correctly in Drupal.

## Phase 1: Flat Data Import ✅ (CURRENT)

### Purpose
Import and update all **flat field data** (non-relational fields) from Mindat.

### What It Does
1. **Match Minerals**: Match e-Rocks minerals to Mindat database
   - Exact ID matches
   - Exact name matches
   - Fuzzy name matching
   - Formula matching
   - Variety/synonym parent matching

2. **Update Flat Fields** (Mindat as source of truth):
   - Title, Formula, Crystal System
   - Colour, Streak, Hardness
   - Strunz classification
   - IMA status, Mindat URL
   - Type locality
   - **Mindat Description Short** (metadata)

3. **Identify New Minerals**: Find Mindat minerals not in e-Rocks
   - Status: APPROVED, PENDING PUBLICATION, GRANDFATHERED
   - Output ready for import

### Input
- e-Rocks CSV export (`minerals.csv`) - ~9,000 rows

### Output Files
- `erocks_UPDATE.csv` - Matched minerals with updated flat data
- `erocks_EXCEPTIONS.csv` - Unmatched minerals (keep as-is)
- `erocks_SKIPPED.csv` - Non-mineral records
- `mindat_NEW_MINERALS.csv` - New minerals to import
- `match_report.json` - Statistics

### Command
```bash
npm run enrich-erocks /path/to/minerals.csv /output/directory
```

### User Action Required
1. Review `erocks_UPDATE.csv` and `mindat_NEW_MINERALS.csv`
2. Import both files into Drupal
3. **Export fresh e-Rocks CSV** with all minerals (including newly imported ones)
   - ⚠️ Critical: This export must include Nids for all minerals

---

## Phase 2: Relationship Resolver 🚧 (PLANNED)

### Purpose
Populate **relationship/lookup fields** using e-Rocks entity references (Nids).

### Why Separate Phase?
- New minerals from Phase 1 don't have Nids until imported into Drupal
- Relationships require complete Nid mapping (all minerals must exist)
- Cleaner separation: flat data first, relationships second

### What It Will Do
1. **Build Nid Lookup Table**
   - Load updated e-Rocks CSV (post Phase 1 import)
   - Create mapping: `{ mindatId: erocksNid }`
   - Include all existing + newly imported minerals

2. **Resolve Relationships to Nids**
   - Query Mindat for relationship data:
     - `variety_of` (Mindat ID) → resolve to e-Rocks Nid
     - `group_id` (Group ID) → resolve to e-Rocks Nid
     - `syn_id` (Synonym ID) → resolve to e-Rocks Nid
     - `polytype_of` (text/ID) → resolve to e-Rocks Nid

3. **Populate Entity Reference Fields**
   - `Variety Of` → e-Rocks Nid of parent mineral
   - `Group Parent` → e-Rocks Nid of group
   - `Synonym Of` → e-Rocks Nid of main mineral
   - `Polytype Of` → e-Rocks Nid of parent polytype

### Input
- Fresh e-Rocks CSV export (post Phase 1 import) with all Nids
- Mindat database (via Neon)

### Output Files
- `erocks_RELATIONSHIPS.csv` - Just Nid + relationship fields for update
  - Columns: `Nid`, `Variety Of`, `Group Parent`, `Synonym Of`, `Polytype Of`

### Command (Planned)
```bash
npm run resolve-relationships /path/to/updated-minerals.csv /output/directory
```

### User Action Required
1. Review `erocks_RELATIONSHIPS.csv`
2. Import into Drupal (updates existing nodes with relationships)

---

## Relationship Fields: Mindat → e-Rocks Mapping

### ✅ Structured Relationships (Phase 2 will handle)
| Mindat Field | Type | e-Rocks Field | Resolution |
|--------------|------|---------------|------------|
| `variety_of` | integer (Mindat ID) | `Variety Of` | Mindat ID → e-Rocks Nid |
| `group_id` | integer (Group ID) | `Group Parent` | Mindat Group ID → e-Rocks Nid |
| `syn_id` | integer (Mindat ID) | `Synonym Of` | Mindat ID → e-Rocks Nid |
| `polytype_of` | text | `Polytype Of` | Text/ID → e-Rocks Nid |

### ⚠️ Unstructured Relationships (Manual review)
| Relationship Type | Mindat Field | Example | Status |
|-------------------|--------------|---------|--------|
| Analogues | `description_short` | "The Sr analogue of aragonite" | 📝 In metadata column |
| Series | `description_short` | "Member of X series" | 📝 In metadata column |
| Comparisons | `description_short` | "Compare X and Y" | 📝 In metadata column |

### ❌ Not in Mindat (Preserve e-Rocks values)
- `Dimorph Of`
- `Group Members`
- `Polymorph of`
- `Mixture Of`
- `Isostructural with`
- `Renamed To`

---

## Workflow Diagram

```
┌─────────────────────────────────────────┐
│ START: e-Rocks CSV Export (9000 rows)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ PHASE 1: Flat Data Import               │
│ - Match to Mindat                        │
│ - Update flat fields                     │
│ - Identify new minerals                  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ OUTPUT: erocks_UPDATE.csv                │
│         mindat_NEW_MINERALS.csv          │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ USER: Import into Drupal                 │
│ - Import UPDATE.csv (updates existing)   │
│ - Import NEW_MINERALS.csv (creates new)  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ USER: Export fresh CSV with all Nids     │
│ (Includes newly imported minerals)       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ PHASE 2: Relationship Resolver           │
│ - Build Mindat→Nid lookup table          │
│ - Resolve relationships to Nids          │
│ - Generate relationship CSV              │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ OUTPUT: erocks_RELATIONSHIPS.csv         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ USER: Import relationships into Drupal   │
│ (Updates entity reference fields)        │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ COMPLETE: Fully enriched e-Rocks data    │
│ - All flat fields updated                │
│ - All relationships populated            │
│ - New Mindat minerals imported           │
└──────────────────────────────────────────┘
```

---

## Benefits of Two-Phase Approach

1. **Data Integrity**: New minerals get Nids before relationships reference them
2. **Simplicity**: Each phase focused on one task
3. **Debugging**: Can verify Phase 1 results before running Phase 2
4. **Safety**: Flat data import doesn't risk breaking entity references
5. **Completeness**: Phase 2 works with full Nid mapping including new minerals

---

## Current Status

- ✅ **Phase 1**: Complete and tested
- 🚧 **Phase 2**: Architecture designed, implementation pending
- 📝 **Documentation**: Updated with two-phase process

---

## Next Steps

1. Run Phase 1 on production e-Rocks CSV (~9,000 rows)
2. Review and import Phase 1 outputs into Drupal
3. Export fresh CSV with all Nids
4. Build Phase 2 relationship resolver script
5. Test Phase 2 on sample data
6. Run Phase 2 to populate all relationships
