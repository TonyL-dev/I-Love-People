$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
  # Keep the system's Node/Python installation unchanged. This bootstrap needs npm and Python/pip.
  npm install --prefix .tools/js --no-save --package-lock=false --engine-strict=false node@24 pnpm@11.19.0
  if ($LASTEXITCODE -ne 0) { throw 'Portable Node/pnpm installation failed.' }
  $env:PATH = "$projectRoot/.tools/js/node_modules/node/bin;$env:PATH"
  python -m pip install --target .tools/uv uv==0.13.9
  if ($LASTEXITCODE -ne 0) { throw 'Local uv installation failed.' }
  & .tools/uv/bin/uv.exe python install 3.12
  if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 installation failed.' }
  & .tools/uv/bin/uv.exe sync --locked
  if ($LASTEXITCODE -ne 0) { throw 'Python dependency synchronization failed.' }
  & .tools/js/node_modules/node/bin/node.exe .tools/js/node_modules/pnpm/bin/pnpm.cjs install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'JavaScript dependency synchronization failed.' }
  Write-Host 'Ready. Run .venv/Scripts/python.exe scripts/tasks.py check from the repository root.'
} finally {
  Pop-Location
}
