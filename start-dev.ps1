# DevWars - Start Development Servers

Write-Host "🚀 Starting DevWars Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Check if MongoDB is running
Write-Host "📊 Checking MongoDB..." -ForegroundColor Yellow
$mongoProcess = Get-Process | Where-Object {$_.ProcessName -like "*mongod*"}
if (-not $mongoProcess) {
    Write-Host "⚠️  MongoDB is not running. Please start MongoDB first." -ForegroundColor Red
    Write-Host "   Run: mongod --dbpath <your-db-path>" -ForegroundColor Gray
} else {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
}
Write-Host ""

# Check if Redis is running
Write-Host "📊 Checking Redis..." -ForegroundColor Yellow
$redisProcess = Get-Process | Where-Object {$_.ProcessName -like "*redis*"}
if (-not $redisProcess) {
    Write-Host "⚠️  Redis is not running (optional, but recommended)" -ForegroundColor Yellow
    Write-Host "   Run: redis-server" -ForegroundColor Gray
} else {
    Write-Host "✅ Redis is running" -ForegroundColor Green
}
Write-Host ""

# Start Backend
Write-Host "🔧 Starting Backend Server (Port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev"
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "🎨 Starting Frontend Server (Port 8080)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\code-arena'; npm run dev"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "✅ Development servers starting..." -ForegroundColor Green
Write-Host ""
Write-Host "📍 URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:8080" -ForegroundColor White
Write-Host "   Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "   API Docs: http://localhost:3000/api/v1" -ForegroundColor White
Write-Host ""
Write-Host "🔍 To test authentication:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:8080 in your browser" -ForegroundColor Gray
Write-Host "   2. Try registering a new user" -ForegroundColor Gray
Write-Host "   3. Check browser DevTools → Application → Cookies" -ForegroundColor Gray
Write-Host "   4. You should see 'accessToken' and 'refreshToken' cookies" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Check backend logs for '[DEBUG authenticate]' messages" -ForegroundColor Yellow
Write-Host ""
