# E-Rocks ↔ Mindat Field Mapping

## Merge Rules for `erocks_UPDATE.csv`

### ALWAYS Keep e-Rocks Value (Never Overwrite):
- **Nid** - Drupal node ID (database key)
- **Created** - Original creation timestamp
- **Updated** - Will be updated to current timestamp on import
- **Description** - Custom e-Rocks content (not in this CSV, but preserve if exists)

### ALWAYS Use Mindat as Source of Truth (Overwrite if different):
All other fields below should be updated from Mindat data:

| e-Rocks Field | Mindat Field | Notes |
|---------------|--------------|-------|
| Title | name | Mineral name |
| Mindat ID | mindat_id | Unique identifier |
| Formula | formula (or ima_formula) | Chemical formula |
| Strunz | strunz_id | Strunz classification |
| Crystal System | crystal_system | Crystal system |
| Colour | colour | Color description |
| Streak | streak | Streak color |
| Hardness Min | hardness (parse range) | Mohs hardness minimum |
| Hardness Max | hardness (parse range) | Mohs hardness maximum |
| Mindat Status | ima_status | IMA approval status |
| Mindat URL | Construct from mindat_id | https://www.mindat.org/min-{id}.html |
| Type Locality | type_localities | Type locality description |
| Class | "Mineral" | Always "Mineral" for matched records |
| Polytype Of | polytype_of | ✅ From Mindat `polytype_of` field |
| Synonyms | synonyms | From Mindat data |
| Unnamed | unnamed | Flag if unnamed |

### Relationship Fields - Mapped from Mindat:
| e-Rocks Field | Mindat Field | Data Type | Mapping Strategy |
|---------------|--------------|-----------|------------------|
| **Variety Of** | variety_of | integer (Mindat ID) | ✅ Resolve Mindat ID → mineral name |
| **Polytype Of** | polytype_of | text | ✅ Direct text transfer |
| **Group Parent** | group_id | integer (Group ID) | ✅ Resolve Group ID → group name |
| **Synonym Of** | syn_id | integer (Mindat ID) | ✅ Resolve Mindat ID → mineral name |

### Relationship Fields - NOT Available in Mindat (Keep e-Rocks Value):
These fields exist in e-Rocks but have no equivalent in Mindat data. **PRESERVE existing e-Rocks values**.

| e-Rocks Field | Status | Notes |
|---------------|--------|-------|
| **Dimorph Of** | ⚠️ Not in Mindat - preserve e-Rocks value | - |
| **Group Members** | ⚠️ Not in Mindat - preserve e-Rocks value | - |
| **Polymorph of** | ⚠️ Not in Mindat - preserve e-Rocks value | - |
| **Mixture Of** | ⚠️ Not in Mindat - preserve e-Rocks value | - |
| **Isostructural with** | ⚠️ Not in Mindat - preserve e-Rocks value | - |
| **Renamed To** | ⚠️ Not in Mindat - preserve e-Rocks value | - |

### Relationship Data in Mindat Text Fields:
Some relationship information exists in Mindat but only as unstructured text:

| Relationship Type | Mindat Field | Example | Extraction |
|-------------------|--------------|---------|------------|
| **Analogues** ("X analogue of Y") | `description_short` | "The Sr analogue of aragonite and witherite" (ID 3805) | 📝 Manual review required - text parsing needed |
| **Series Members** | `description_short` | Often mentions series membership | 📝 Manual review required |
| **Comparisons** ("Compare X") | `description_short` | "Compare olekminskite and..." | 📝 Manual review required |

**Recommendation**: Include Mindat `description_short` field in UPDATE CSV for manual review of analogue/series relationships.

### Fields Not in Mindat (Keep e-Rocks Value):
- Published status
- Approval status (e-Rocks workflow status)
- Habit Of
- Source

### New Metadata Fields (Append):
- Match Type
- Match Confidence
- Needs Review
- Is Variety
- Is Synonym
- Parent Mineral
- Data Conflicts
- **Mindat Description Short** - Contains analogue/comparison/series relationship hints for manual review (e.g., "The Sr analogue of aragonite", "Compare X and Y")

## Field Value Priority

```
IF e-Rocks.Nid EXISTS:
    OUTPUT.Nid = e-Rocks.Nid  // Keep database key

IF field == "Description":
    OUTPUT.Description = e-Rocks.Description  // Never overwrite

ELSE IF Mindat has value:
    OUTPUT.field = Mindat.value  // Mindat is source of truth

ELSE:
    OUTPUT.field = e-Rocks.value  // Fallback to e-Rocks if Mindat missing
```

## Example Row Processing

### Input:
**e-Rocks:**
```
Title: "Quartz"
Formula: "SiO2"
Crystal System: "Trigonal"  ← WRONG
Hardness Min: "7"
Mindat ID: "3337"
```

**Mindat (ID 3337):**
```
name: "Quartz"
formula: "SiO2"
crystal_system: "Hexagonal"  ← CORRECT
hardness: "7"
strunz_id: "04.DA.05"
```

### Output (`erocks_UPDATE.csv`):
```
Title: "Quartz"
Formula: "SiO2"  ← Kept (matches Mindat)
Crystal System: "Hexagonal"  ← UPDATED from Mindat (was wrong)
Hardness Min: "7"  ← Kept (matches Mindat)
Mindat ID: "3337"
Strunz: "04.DA.05"  ← FILLED from Mindat (was blank)
Match Type: "exact_id"
Match Confidence: 100
Needs Review: FALSE
Data Conflicts: "Crystal System changed: Trigonal → Hexagonal"
```

## Import Safety

When re-importing to Drupal:
1. ✅ Match by **Nid** (node ID) - safe update of existing records
2. ✅ **Description field excluded from CSV** - won't overwrite custom content
3. ✅ All scientific data updated from Mindat (source of truth)
4. ✅ Review "Data Conflicts" column before import
5. ✅ Filter "Needs Review = TRUE" for manual verification
