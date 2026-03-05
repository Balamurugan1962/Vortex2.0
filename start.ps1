# Vortex 2.0 Startup Script
# Run all services for exam monitoring

Write-Host "Starting Vortex 2.0 Exam Monitoring System..." -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Yellow
Write-Host ""

# Start FastAPI in background
Write-Host "[1/2] Starting FastAPI Monitoring Service (Port 8000)..." -ForegroundColor Cyan
$checkerPath = Join-Path $PSScriptRoot "checker"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$checkerPath'; python main.py" -WindowStyle Normal

# Wait for FastAPI to start
Start-Sleep -Seconds 3

# Check if FastAPI is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/camera_test" -TimeoutSec 2 -UseBasicParsing
    Write-Host "✓ FastAPI service started successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠ FastAPI may still be starting..." -ForegroundColor Yellow
}

Write-Host ""

# Start Tauri dev server
Write-Host "[2/2] Starting Tauri Application..." -ForegroundColor Cyan
$frontendPath = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendPath

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "  Vortex 2.0 System Running" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "FastAPI Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host "WebSocket (Video): ws://localhost:8000/ws/video" -ForegroundColor Yellow
Write-Host "WebSocket (Violations): ws://localhost:8000/ws/violations" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop Tauri (FastAPI will continue in separate window)" -ForegroundColor Gray
Write-Host ""

# Start Tauri in this window
npm run tauri dev
