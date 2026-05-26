# AQUAS — Product Reference

**A · Q · U · A · S**  
Application · Questions · Answers · Apply · Submit

This repo is the operator layer — Deric running AQUAS on his own applications.  
The running product is the Next.js app at: **mos2es.xyz** (AQUA surface)

What you see in this repo is the data pipeline the product is built on.  
Every file here maps to a screen, a lane, or a data model in the app.

---

## Pipeline map

| Lane | Folder | App equivalent |
|---|---|---|
| Inbox | `01-inbox/` | Raw program discovery queue |
| Processing | `02-processing/` | Triage + extraction workspace |
| Programs | `03-programs/` | Program directory (the Hub) |
| Applications | `04-applications/` | Blank form templates library |
| Questions | `05-questions/` | Question archive (the Bank) |
| Apply | `06-apply/` | Active application workstation |
| Answers | `07-answers/` | Rolling answer bank |
| Submitted | `08-submitted/` | Immutable submission record |
