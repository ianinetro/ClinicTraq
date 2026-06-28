# Clarity — EDI 835 Architecture Reference

This document captures how the **Clarity** claims dashboard project handles EDI 835
ERA files. It is intended to inform ClinicTraq's own ERA/835 implementation so we
can adopt proven patterns rather than reinventing them.

---

## Tech Stack Choices (Clarity)

| Layer | Technology | Notes |
|---|---|---|
| Backend | Python 3.12 + FastAPI + SQLAlchemy 2.0 async | Same async pattern as ClinicTraq |
| Parsing engine | **Polars** | Vectorized DataFrame library; much faster than pandas for large files |
| Background jobs | **Arq + Redis** | Lightweight async task queue; similar role to ClinicTraq's Celery |
| Database | PostgreSQL 16 | Same as ClinicTraq |
| Storage | **Local disk only** — no S3 | Single-VM constraint; files land at `UPLOAD_DIR/YYYY/MM/DD/{upload_id}/` |
| Frontend | Next.js 15 + React 19 + TypeScript | Different from ClinicTraq's Vite/React setup |

**Critical rule in Clarity:** Parsers NEVER run inline in an API request handler.
Every parse job is enqueued to Arq and executed by a dedicated worker process.

---

## EDI 835 Input Formats Supported

Clarity's `Era835Parser` transparently handles three input shapes:

| Format | Detection method |
|---|---|
| Raw `.835` / `.edi` / `.txt` | Magic bytes: ISA segment at byte 0 |
| `.xlsx` / `.xls` / `.csv` spreadsheet | Extension + OOXML magic bytes |
| **OfficeAlly ZIP bundle** (`*.zip`) | ZIP magic bytes; extracts `*_ERA_835_*.835` from inside |

Detection logic reads the first few bytes (magic-byte sniffing) before trusting the
file extension. This handles misnamed or renamed files gracefully.

---

## EDI 835 Walker — How the Raw EDI Is Parsed

File: `apps/api/src/app/parsers/edi_835.py` → function `walk_edi_835`

### Delimiter Discovery (critical)

Do NOT hardcode `*`, `:`, `~` as the ISA delimiters. The ISA segment has a fixed
byte layout that encodes the actual delimiters used in the file:

```
ISA[3]  = element separator (usually *)
ISA[104] = component separator (usually :)
ISA[105] = segment terminator (usually ~ or \n)
```

Read these from the raw bytes on every file. Different payers write differently;
hardcoded delimiters will silently corrupt real-world files.

### State Machine

The walker tracks three levels of context as it reads segments:

```
transaction (ISA/GS/ST level)
  └── claim (CLP segment)
        └── service line (SVC segment)
              └── adjustments (CAS segments)
```

Segments processed:

| Segment | Purpose |
|---|---|
| `ISA` / `GS` / `ST` | Open transaction; read delimiters, payer control |
| `BPR` | Payment date, total payment amount |
| `N1 PR` | Payer name + payer ID |
| `N1 QC` | Patient name |
| `CLP` | One claim per CLP: claim ID, status, charged/paid amounts, `payer_control_no` (CLP07) |
| `NM1` | Subscriber / rendering provider names |
| `SVC` | Service line: CPT (HC:xxxx), charged, paid |
| `DTM 472` | Date of service for current SVC |
| `CAS` | Adjustment: group code (CO/PR/OA), reason code, amount |
| `LQ HE` | Remark code for current SVC |
| `MOA` | Claim-level remark codes |
| `SE` / `GE` / `IEA` | Close transaction |

### Output Grain — One Row Per (SVC, CAS) Pair

This is the most important design decision: **one output row per adjustment reason**,
not one row per claim or one row per service line.

```
SVC with 2 CAS adjustments → 2 rows
SVC with 0 CAS entries     → 1 stub row (no adjustment_reason_code)
CLP with no SVC lines      → 1 claim-level stub row
```

Why: denial analysis always operates at the adjustment-reason level. Flattening to
one row per claim loses which specific reason codes fired.

### Synthetic Service-Line ID

Each SVC occurrence gets a synthesized `service_line_id`:

```
{claim_id}::{cpt_code}::{index}
```

The `index` is the ordinal position of this SVC within the CLP. This is necessary
because the EDI format has no native service-line identifier.

---

## Business Rules (Exclusion Rules)

Defined in `apps/api/src/app/parsers/exclusions.py`. Applied during parsing, before
any data is written to the database. Every excluded row writes a `record_change_log`
entry with the rule ID that fired.

| Rule | Trigger | Action |
|---|---|---|
| Adjustment code filter | `adjustment_reason_code` in {CO-45, PR1, PR2, PR3} | Drop row (prior/contract payment, not a denial) |
| Penny row filter | `charged == $0.01 AND paid == $0.01` | Drop row (rounding artifact) |
| Quality measure filter | CPT ends in F or G, or matches `G####` pattern | Drop row (quality measure codes, not clinical billing) |

---

## Denial Classification

A row is classified as a denial when:

```python
is_denial = (insurance_payment is None or insurance_payment == 0) \
            and adjustment_reason_code is not None
```

A line paid $50 with CO-45 (contractual adjustment) is **not** a denial — it was
paid at the fee-schedule rate. Only zero-pay lines with an adjustment code count.

This flag is computed after exclusion rules, so CO-45 rows are already gone by the
time denial classification runs.

---

## Payer Mapping

Payer classification (`payer_type`, `payer_region`) is applied per parsed row via a
lookup against the `payer_mappings` table. Key rules:

- Lookup is by **payer name** (normalized: `UPPER(TRIM(name))`), NOT by payer ID.
  Source reports rarely carry a reliable payer ID; name is more stable.
- Admin-editable via UI; no code deploy needed to add a new payer mapping.
- Fallback: unmatched payer → `payer_type='Non-Medicare'`, `payer_region=null`.

---

## Unique Key and Idempotent Upserts

File: `apps/api/src/app/parsers/keying.py`

### Why a Unique Key

The same claim can legitimately appear in multiple ERA files (incremental daily
feeds, re-sends, corrections). The unique key lets the upsert engine determine
whether a row is new, changed, or unchanged without querying by claim_id alone.

### ERA 835 Key Strategy

Primary key (all fields must be non-null for this to apply):

```
claim_id | adjustment_group | adjustment_reason_code | payer_control_no | service_line_id
```

Fallback key (when some fields are null):

```
claim_id | patient_id | payment_date | denial_reason_code | charged_amount | payer_control_no
```

**Why `payer_control_no` (CLP07) is in the key:** The same claim can appear twice in
one ERA — once as a reversal and once as a reissue — with different `payer_control_no`
values. Both are valid financial events whose amounts net correctly. Including
`payer_control_no` keeps them as separate rows instead of collapsing them.

### Source Hash

Alongside the unique key, each row gets a `source_hash` (SHA256 of all business
fields). On re-import of the same file:

- Same unique_key + same source_hash → **unchanged** (no DB write)
- Same unique_key + different source_hash → **update** (write new values)
- New unique_key → **insert**

This makes repeated uploads of the same file a no-op at the DB level.

---

## Upload and Worker Flow

```
User uploads file
      │
      ▼
POST /api/uploads
  • Validate extension, content-type, size (max 500 MB)
  • Stream to disk: UPLOAD_DIR/YYYY/MM/DD/{upload_id}/{filename}
  • Create report_uploads row: status=queued
  • Enqueue process_upload(upload_id) → Arq/Redis
      │
      ▼
Arq worker: process_upload(upload_id)
  1. Mark status=processing
  2. Open single DB transaction:
       read file → detect format → parse → normalize headers
       → apply exclusion rules → enrich (payer mapping, is_denial)
       → compute unique_key + source_hash
       → dedup check within file (reject if duplicate unique_key)
       → batch upsert
       → write record_change_log
     On exception → rollback → status=failed, error_message saved
  3. Write final counts (inserted/updated/unchanged/deactivated/excluded)
  4. Refresh lifecycle rollup (claim state transitions)
  5. Mark status=success
```

**Atomicity guarantee:** Either all rows from a file land in the database or none
do. There are no partial imports.

---

## Batch Upsert — PostgreSQL Binding Limit

PostgreSQL has a hard limit of 32,767 bind parameters per statement. For a table
with 24 columns, that allows at most ~1,365 rows per INSERT statement.

Clarity's upsert engine computes the max batch size dynamically:

```python
max_rows = (32767 - 1000) / column_count  # 1000 headroom for safety
```

Large files are automatically chunked into multiple batches. The
`record_change_log` inserts are also batched separately.

---

## Data Models — Key Tables

| Table | Purpose |
|---|---|
| `report_uploads` | One row per file upload: metadata, status, parse_stats JSONB |
| `denial_management_records` | One row per (SVC, CAS) pair from parsed ERA files |
| `record_change_log` | Audit trail: one row per parser decision (inserted/updated/unchanged/deactivated/excluded) with rule ID |
| `payer_mappings` | Admin-editable payer name → type/region classification |

### Key columns on `denial_management_records`

| Column | Purpose |
|---|---|
| `unique_key` | Composite identifier; enforces uniqueness across uploads |
| `source_hash` | SHA256 of business fields; detects unchanged rows on re-import |
| `raw_row` | JSONB of original source columns (audit trail) |
| `first_seen_upload_id` | Which upload first inserted this row |
| `last_seen_upload_id` | Which upload last touched this row |
| `is_active` | Soft-delete flag; set to false in full-refresh mode for rows not in the new file |
| `payer_control_no` | CLP07 value; distinguishes reversals from reissues |

---

## Full-Refresh vs Incremental Mode

| Mode | Behavior |
|---|---|
| **Incremental** | Adds/updates rows only. Never deactivates. Use for daily feeds. |
| **Full-refresh** | After upsert, marks `is_active=false` for any row from prior uploads whose `unique_key` does not appear in the new file. Use for year-to-date overhauls. |

---

## Patterns Worth Adopting in ClinicTraq

1. **Lazy delimiter detection** — read delimiters from ISA bytes; never hardcode `*:~`.
2. **One row per (SVC, CAS) pair** — preserves adjustment-reason granularity for denial analysis.
3. **`payer_control_no` in the unique key** — correctly handles reversal + reissue CLPs in the same ERA.
4. **Parser runs in worker, never inline** — keeps upload endpoints fast and prevents timeout failures on large files.
5. **Single transaction per file** — atomic imports; no partial state on parser errors.
6. **source_hash for idempotency** — re-uploading the same file does nothing; detecting actual changes is cheap.
7. **Exclusion rules log to change_log** — every dropped row has a documented reason, auditable after the fact.
8. **Format-agnostic parser** — accept raw EDI, ZIP bundles, and spreadsheets through the same endpoint/interface.
