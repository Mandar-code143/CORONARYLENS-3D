# CoronaryLens-3D project notes

CoronaryLens-3D is an educational/research prototype for four separate public-cohort targets: CAD (mapped from `Cath`), LAD stenosis, LCX stenosis, and RCA stenosis. It is not a medical device and must not be used for patient care.

## Run locally

- Use Node.js 22 and pnpm 10.12.1 (`corepack enable`, then `corepack prepare pnpm@10.12.1 --activate`).
- Install the frontend/API dependencies with `pnpm install --frozen-lockfile`.
- Use Python 3.13 and `python -m pip install -r requirements-research.txt`. Keep pinned versions consistent with the included joblib model artifacts.
- In one terminal, set `PORT=8080` and run `pnpm --filter @workspace/api-server run build`, then `pnpm --filter @workspace/api-server run start`. In a second terminal, set `PORT=5173`, `BASE_PATH=/` and run `pnpm --filter @workspace/coronarylens-3d run dev`. Vite proxies `/api` to the API on port 8080.
- For the exact Windows commands, see `README.md` and `scripts/run-local.ps1`.

## Main files

- `artifacts/coronarylens-3d/src/App.tsx`: pages, user workflow and model score dashboard.
- `artifacts/coronarylens-3d/src/components/CoronaryScene.tsx`: schematic Three.js heart/coronary branches with score-driven color mapping.
- `artifacts/api-server/src/routes/coronarylens.ts`: readiness, schema, inference and request-bound explanation endpoints.
- `scripts/prepare_data.py`: source data preparation/schema/audit.
- `scripts/train_models.py`: nested model selection/evaluation and final research-artifact training.
- `scripts/infer_models.py`: validated JSON inference/explanation adapter.
- `docs/HACKATHON_REQUIREMENTS.md`: rubric gap audit.

## Reproducibility and limitations

- The source cohort has 303 records; use nested CV figures as internal estimates only. External validation and calibration are absent.
- The 3D heart remains schematic and is not a real anatomical mesh, patient scan, or lesion locator.
- Input descriptions/ranges and any feature units require clinical/source-codebook review. Do not invent values or claim 100% accuracy.
- Model artifacts are version-sensitive and are checked by dataset/schema/model checksums.
- Before submission, run `python -m pytest -q`, `pnpm run typecheck`, frontend/API builds and (if using it) a clean Docker build. The artifact packaging environment was unable to download JavaScript dependencies, so that build has not been verified here.
