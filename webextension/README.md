# WebExtensions

Browser extensions and userscripts for this repo.

---

## Browser reference

| Folder              | What's inside                                  |
| ------------------- | ---------------------------------------------- |
| [chrome/](chrome/)  | Dev setup, store info, deployment record       |
| [firefox/](firefox/)| Dev setup, web-ext CLI, AMO record             |
| [safari/](safari/)  | Userscript path + native extension path, store |

---

## Projects

| Folder                              | What it is                          | Browsers                      |
| ----------------------------------- | ----------------------------------- | ----------------------------- |
| application-hub/                    | Answer bank + AI drafting companion | Chrome, Firefox, Edge, Safari |

---

## Adding a new project

1. Create `webextension/<project-name>/`
2. Initialize WXT: `cd <project-name> && npx wxt@latest init .`
3. Add a `README.md` inside the folder
4. Add a userscript at `<project-name>/userscript/<name>.user.js` if needed
5. Log the deployment in the relevant browser `README.md` files above

---

## Shared rules

- Each project is self-contained — its own `package.json`, `node_modules`, build output
- Use WXT as the build framework
- Anon key (`sb_publishable_*`) is safe to ship in client code — RLS enforces isolation
- Never put the Supabase service role key in any extension or userscript
