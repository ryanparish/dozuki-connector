# GitHub setup

Do **not** commit `.env` or API keys. They are ignored via `.gitignore`.

## Repo secrets / variables

In your GitHub repository: **Settings → Secrets and variables → Actions**:

| Name               | Typical use                          |
|--------------------|--------------------------------------|
| `DOZUKI_API_KEY`   | **Secret** — API authentication token |
| `DOZUKI_APP_ID`    | Optional **Secret**, if Dozuki issues an app ID |
| `DOZUKI_BASE_URL`  | **Variable** — e.g. `https://gp-sandbox.dozuki.com` |
| `DOZUKI_GUIDE_ID`  | **Variable** — default guide ID for scripted jobs (optional) |

CI only type-checks (`npm run check`). If you later add jobs that hit the API, map these names with `secrets.DOZUKI_API_KEY`, etc., in workflow `env`.

## Push this folder to GitHub

Replace `OWNER`/`REPO` with yours:

```powershell
cd C:\Users\wparish\dozuki-middleware-agent
git init
git checkout -b main
git add .
git commit -m "Initial import: Dozuki middleware agent"
git remote add origin https://github.com/OWNER/REPO.git
git push -u origin main
```

## Local secrets

Copy `.env.example` to `.env`, fill values, leave `.env` uncommitted:

```powershell
Copy-Item .env.example .env
```
