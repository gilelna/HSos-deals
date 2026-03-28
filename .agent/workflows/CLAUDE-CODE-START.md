# Start here — Claude Code session opener

Copy and paste this at the start of every Claude Code session.

---

```
You are working on Lessons OS — a business operations system for an English
tutoring business. Before doing anything else:

1. Read docs/CLAUDE.md — full project context, stack, data model
2. Read docs/CONVENTIONS.md — code rules you must follow
3. Read docs/SCHEMA.md — database schema reference
4. Tell me what you understand about the project in 3 sentences

Then wait for my first task.

Key rules:
- Plain HTML + Vanilla JS only. No frameworks.
- All DB operations go through supabase-client.js, never inline
- Never rewrite UI — only touch data layer unless asked
- All async calls use try/catch + showToast() for errors
- After every change: verify no alerts remain, no broken references
```

---

## Common first tasks

### "Connect to database"
```
Read all .html files and supabase-client.js.
Connect deals.html and workload.html to Supabase following CONVENTIONS.md.
Replace static arrays with async DB calls.
Add loadAll() and DOMContentLoaded handler.
```

### "Build invoicing module"
```
Read docs/MODULES.md section 3 (Invoicing).
Read deals.html for design system reference.
Build invoicing.html as a new module.
Use static dummy data — no Supabase yet.
```

### "Build reporting module"
```
Read docs/MODULES.md section 4 (Reporting).
Read deals.html for design system reference.
Build reporting.html with monthly P&L view.
Use static dummy data — no Supabase yet.
```

### "Generate schema"
```
Read all .html files.
Generate schema.sql and schema-seed.sql following docs/SCHEMA.md.
```
