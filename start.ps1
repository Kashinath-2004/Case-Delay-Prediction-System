$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$pythonEnvironment = Join-Path $projectRoot ".venv311"
$pythonExecutable = Join-Path $pythonEnvironment "Scripts\python.exe"

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' was not found. Install Python 3.11 (64-bit), then reopen PowerShell."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js LTS, then reopen PowerShell."
}

Push-Location $projectRoot
try {
    if (-not (Test-Path $pythonExecutable)) {
        py -3.11 -m venv $pythonEnvironment
        if ($LASTEXITCODE -ne 0) {
            throw "Could not create the Python 3.11 environment. Confirm Python 3.11 is installed with 'py -3.11 --version'."
        }
    }

    & $pythonExecutable -m pip install -r (Join-Path $projectRoot "requirements-web.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "Python dependencies failed to install. Review the pip error above."
    }

    Push-Location (Join-Path $projectRoot "web")
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "Web dependencies failed to install. Review the npm error above."
        }
    }
    finally {
        Pop-Location
    }

    Start-Process -FilePath $pythonExecutable `
        -ArgumentList @("-m", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload") `
        -WorkingDirectory $projectRoot

    Write-Host "API starting at http://127.0.0.1:8000/docs in a separate window."
    Write-Host "Starting the frontend; open http://localhost:3000 when Vite is ready."
    Push-Location (Join-Path $projectRoot "web")
    try {
        npm run dev -- --host 127.0.0.1
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}