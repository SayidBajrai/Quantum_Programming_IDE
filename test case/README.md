# Test Case Suite

Automated tests for the Quantum Programming IDE.

## Contents

| File | Description |
|------|-------------|
| `bell.qasm` | Sample Bell-state circuit with measurements |
| `superposition.qasm` | Single-qubit superposition sample |
| `test_api.py` | Backend unit tests and HTTP API tests |
| `test_ui.mjs` | Browser UI tests (tab switching and simulation) |
| `package.json` | Playwright dependency for UI tests |

## Run All Tests

From the project root:

```batch
testcase.bat
```

## Run Individually

### Backend / API tests (server optional for unit tests)

```batch
call .venv\Scripts\activate.bat
python "test case\test_api.py"
```

HTTP tests require the server at `http://127.0.0.1:5010`:

```batch
set TEST_BASE_URL=http://127.0.0.1:5010
python "test case\test_api.py"
```

### UI tests (server required)

```batch
cd "test case"
npm install
npx playwright install chromium
set TEST_BASE_URL=http://127.0.0.1:5010
npm run test:ui
```

## What Is Tested

- OpenQASM 3 compilation and simulation (Bell state, superposition)
- Missing-measurement error handling
- Page routes (`/home`, `/compiler`, `/circuit`)
- Tabbed right panel markup
- Simulation Results tab visibility on compiler and circuit pages
- End-to-end simulation from the UI
