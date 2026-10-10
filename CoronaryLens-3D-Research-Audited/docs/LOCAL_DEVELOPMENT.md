# Local development

Use Node.js 22, Corepack/pnpm 10.12.1, and Python 3.13. Install the JavaScript workspace with `pnpm install --frozen-lockfile` and Python dependencies with `python -m pip install -r requirements-research.txt`. The exact Python versions match the included scikit-learn joblib artifacts; upgrading one can invalidate the model bundle.

Start the API and frontend in separate PowerShell terminals as shown in the root README or run `scripts/run-local.ps1` to print the commands. Vite proxies `/api` to `http://127.0.0.1:8080` by default; override with `API_PROXY_TARGET` only if the API runs elsewhere.

When reporting a failure, include OS/version, `node --version`, `corepack pnpm --version`, `python --version`, the exact command, and complete error output. Avoid sharing `.env` files or private data.
