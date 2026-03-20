# CRM + Operations System — Google Sheets + Apps Script

A complete system for managing students, vendors, sessions, and finances using Google Sheets and Apps Script.

---

## 📁 File Overview

| File | Purpose |
|------|---------|
| `setup_master.gs` | Creates the **Master** spreadsheet (7 sheets, formatting, validations) |
| `setup_vendor.gs` | Creates a **Vendor** spreadsheet template (6 sheets, menu, protections) |
| `onEdit_sessions.gs` | Handles session date edits → appends to Master Activity Log |
| `onEdit_worklog.gs` | Handles work log date edits → appends to Master Activity Log |
| `sync_roster.gs` | Pulls assigned clients from Master → Vendor Roster (values only) |
| `monthly_summary.gs` | Recalculates Monthly Summary from Master Activity Log |
| `README.md` | This file |

---

## 🚀 Setup Instructions

### Step 1: Create the Master Spreadsheet

1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Delete the default code, paste the entire contents of `setup_master.gs`
3. Click **▶ Run** → select `createMasterSpreadsheet`
4. Authorize when prompted (first-time only)
5. Check **View → Logs** for the new spreadsheet URL
6. **Copy the spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/<THIS_IS_THE_ID>/edit
   ```

### Step 2: Create a Vendor Spreadsheet

1. In the **same** Apps Script project (or a new one), create these files:
   - `setup_vendor.gs`
   - `onEdit_sessions.gs`
   - `onEdit_worklog.gs`
   - `sync_roster.gs`
   - `monthly_summary.gs`

2. Run `createVendorSpreadsheet`
3. Open the new vendor spreadsheet
4. Go to the **Settings** sheet and replace `<PASTE_MASTER_SPREADSHEET_ID_HERE>` with the Master ID from Step 1
5. Update `person_id` and `person_name` to match this vendor's record in the Master People sheet

### Step 3: Attach Scripts to the Vendor Spreadsheet

1. Open the vendor spreadsheet
2. Go to **Extensions → Apps Script**
3. Create these script files in the project:
   - `onEdit_sessions.gs` — paste full contents
   - `onEdit_worklog.gs` — paste full contents (includes the `onEdit()` dispatcher)
   - `sync_roster.gs` — paste full contents
   - `monthly_summary.gs` — paste full contents
   - Copy the `onOpen()` function from `setup_vendor.gs` into any file

4. The `onEdit()` and `onOpen()` simple triggers will activate automatically

> **Important:** Google Sheets only allows ONE function named `onEdit`. The dispatcher in `onEdit_worklog.gs` handles both sheets by routing to the correct handler.

### Step 4: Share & Permissions

1. **Master spreadsheet**: Share with vendor emails as **Editor** (so scripts can append to Activity Log)
2. **Vendor spreadsheet**: Share with the vendor as **Editor**
3. Sheet protections ensure vendors can only edit designated cells

---

## 🏗 Architecture

```
┌──────────────────────────────────────┐
│          MASTER SPREADSHEET          │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │  People   │  │     Clients      │  │
│  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────────────┐  │
│  │  Deals    │  │  Session Types   │  │
│  └──────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────┐│
│  │  Activity Log (append-only)      ││
│  └──────────────────────────────────┘│
│  ┌──────────┐  ┌──────────────────┐  │
│  │  Monthly  │  │    Settings      │  │
│  │  Payments │  │                  │  │
│  └──────────┘  └──────────────────┘  │
└──────────────────────────────────────┘
        ▲                    │
        │ append rows        │ read clients
        │ (onEdit)           │ (sync roster)
        │                    ▼
┌──────────────────────────────────────┐
│         VENDOR SPREADSHEET           │
│                                      │
│  ┌──────────┐  ┌──────────────────┐  │
│  │  Roster   │  │  Sessions Log    │  │
│  │(read-only)│  │  (vendor input)  │  │
│  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────────────┐  │
│  │ Work Log  │  │ Monthly Summary  │  │
│  │(vendor in)│  │  (calculated)    │  │
│  └──────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌──────────────────┐  │
│  │  Rates    │  │    Settings      │  │
│  │(read-only)│  │  (admin-only)    │  │
│  └──────────┘  └──────────────────┘  │
└──────────────────────────────────────┘
```

---

## 📋 Data Flow

### Session Logging (onEdit)

```
Vendor enters date in Sessions Log col C
         │
         ▼
    ┌─────────────┐
    │  onEdit(e)   │
    │  dispatcher  │
    └──────┬──────┘
           │
           ▼
 ┌───────────────────┐    ┌─────────────────────────┐
 │ Read: client_name │───▶│ Resolve client_id from   │
 │ session_type,     │    │ Master Clients sheet     │
 │ date, notes       │    └─────────────────────────┘
 └───────┬───────────┘
         │
         ▼
 ┌───────────────────┐
 │ Determine status: │
 │ • new → "active"  │
 │ • changed → "updated" │
 │ • cleared → "deleted" │
 └───────┬───────────┘
         │
         ▼
 ┌───────────────────┐
 │ APPEND row to     │  ← never edit existing rows
 │ Master Activity   │
 │ Log               │
 └───────────────────┘
```

### Key Rule: Activity Log is APPEND-ONLY

- **Never** edit or delete rows in the Activity Log
- Changed dates → new row with status `updated`
- Cleared dates → new row with status `deleted`
- The "latest truth" is determined by filtering for `status = 'active'`

---

## 🎨 Formatting Reference

| Element | Color | Hex |
|---------|-------|-----|
| **Header row** | Dark blue-gray, white bold text | BG: `#263238`, FG: `#FFFFFF` |
| **Editable cells** | Light yellow | `#FFF9C4` |
| **Read-only cells** | Light gray | `#F5F5F5` |

---

## 🔧 Custom Menu (Vendor Spreadsheet)

When the vendor opens the spreadsheet, a **🔧 CRM Tools** menu appears:

| Menu Item | Function | What it does |
|-----------|----------|-------------|
| Sync Roster from Master | `syncRosterFromMaster()` | Pulls assigned clients as values |
| Recalculate Monthly Summary | `recalculateMonthlySummary()` | Rebuilds summary from Activity Log |

---

## 📐 ID Conventions

| Entity | Format | Example |
|--------|--------|---------|
| People | `P` + 3 digits | P001, P002 |
| Clients | `C` + 3 digits | C001, C002 |
| Deals | `D` + 3 digits | D001, D002 |
| Session Types | `ST` + 3 digits | ST001, ST002 |
| Activity Log | `A` + 3 digits | A001, A002 |

---

## ⚠️ Constraints & Limitations

- **No external libraries** — pure Apps Script only
- **No triggers other than `onEdit` and manual menu calls**
- **No automatic payroll** — Monthly Payments are entered manually by admin
- **Offline tolerance** — If Master is unreachable, vendor sees `⚠ sync failed` in the status column; their local data is not lost
- **Quota limits** — All operations are designed for standard Google Sheets quotas (single-row appends, no bulk API calls)

---

## 🔄 Creating Additional Vendor Files

For each new vendor:

1. **Duplicate** the vendor template spreadsheet (File → Make a copy)
2. Update the **Settings** sheet:
   - `master_spreadsheet_id` → same Master ID
   - `person_id` → e.g. `P002`
   - `person_name` → e.g. `Bob Chen`
   - `session_types` → adjust if this vendor teaches different types
3. Update **Rates** sheet with this vendor's rates
4. Run **Sync Roster** to pull their assigned clients
5. Share the Master spreadsheet with the vendor's email

---

## 🧪 Testing Checklist

- [ ] Run `createMasterSpreadsheet()` — verify all 7 sheets with formatting
- [ ] Run `createVendorSpreadsheet()` — verify all 6 sheets with formatting
- [ ] Link vendor to master (paste ID into Settings)
- [ ] Enter a date in Sessions Log → check Activity Log in Master
- [ ] Change the date → verify new "updated" row in Activity Log
- [ ] Clear the date → verify new "deleted" row in Activity Log
- [ ] Enter a date in Work Log → check Activity Log
- [ ] Run Sync Roster → verify client data appears
- [ ] Run Recalculate Monthly Summary → verify totals
- [ ] Verify dropdown validations work on all sheets
- [ ] Verify protected ranges block vendor edits on read-only cells
