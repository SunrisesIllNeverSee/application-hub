# Apply URL — Needs Manual Validation

These 13 programs have confirmed apply_url entries in the database but the
pages are JS-rendered (Typeform, Airtable, AcceleratorApp) — automated
extraction got nothing. Someone needs to open each link in a browser,
confirm the form loads and looks real, and optionally copy the question text.

Until validated, these show the "verify link" badge on the hub detail page.

---

## Accelerators (highest value — check these first)

| Program | Type | Apply URL |
| --- | --- | --- |
| New Ventures BC | Typeform | <https://nvbc.typeform.com/to/vboBF4Gr> |
| eCommerce North | Typeform | <https://elevateca.typeform.com/to/bIR5c2lA> |
| Founders Factory | Typeform | <https://form.typeform.com/to/WlDiIsRh> |
| Transcend Network | Typeform | <https://form.typeform.com/to/ptlIt8DC> |
| TechRise Chicago | Airtable | <https://airtable.com/appfgBVkCSJj3MA6Y/pag5b2FJXvTdvGuHG/form> |
| The Hub (UofT) | AcceleratorApp | <https://sicieeil.acceleratorapp.co/application/new?program=sicieeil-ap> |
| UofT Entrepreneurship | AcceleratorApp | <https://ute.acceleratorapp.co/application/new?program=onramp%20members> |

## VCs (check if time allows)

| Program | Type | Apply URL |
| --- | --- | --- |
| 2048 Ventures | Airtable | <https://airtable.com/appV89PYGo3zN47f9/pagNjeYwHGADSGIs3/form> |
| Contrary | Custom portal | <https://applications.contrary.com/> |
| Capitalize VC | Airtable | <https://airtable.com/apppvODtMSw09eCae/pagdarmEj6iMMvBob/form> |
| Everywhere | Airtable | <https://airtable.com/appeY02X0EMCQQ19G/shrjpNqWOj0SJP1ix> |
| Slack Fund | Airtable | <https://airtable.com/app5kO0WaTWMJG0n7/pagIcieB3DVsIxyxp/form> |
| BCF Ventures | F6S | <https://www.f6s.com/bcfventures/apply> |

---

## What to do when you validate one

1. Open the link — confirm the form loads and has real founder questions
2. Copy question text into `seed/staging/fundingcake_questions.csv` manually
   (columns: slug, program_name, type, apply_url, extracted_question)
3. Mark it validated in `seed/staging/fundingcake_apply_urls.csv`
   (change confidence from `high` to `verified`)
4. Remove it from this list

If the link is dead or leads to a contact page, clear `apply_url` in Supabase:

```sql
UPDATE programs SET apply_url = NULL WHERE slug = '<slug>';
```
