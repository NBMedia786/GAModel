# TestSprite MCP Setup Script for Cursor
# This script helps configure TestSprite MCP server

Write-Host "=== TestSprite MCP Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js version
Write-Host "Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green

if ($nodeVersion -match "v(\d+)") {
    $majorVersion = [int]$matches[1]
    if ($majorVersion -lt 22) {
        Write-Host "⚠️  Warning: Node.js version 22 or higher is required" -ForegroundColor Red
        Write-Host "   Current version: $nodeVersion" -ForegroundColor Red
    } else {
        Write-Host "✅ Node.js version meets requirement" -ForegroundColor Green
    }
}

Write-Host ""

# Check if TestSprite MCP is installed
Write-Host "Checking TestSprite MCP installation..." -ForegroundColor Yellow
try {
    $version = npx @testsprite/testsprite-mcp@latest --version 2>&1
    Write-Host "✅ TestSprite MCP is installed (version: $version)" -ForegroundColor Green
} catch {
    Write-Host "❌ TestSprite MCP is not installed" -ForegroundColor Red
    Write-Host "   Installing..." -ForegroundColor Yellow
    npm install -g @testsprite/testsprite-mcp@latest
    Write-Host "✅ Installation complete" -ForegroundColor Green
}

Write-Host ""

# Instructions for API Key
Write-Host "=== API Key Configuration ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "To complete the setup, you need to:" -ForegroundColor Yellow
Write-Host "1. Get your TestSprite API key from: https://testsprite.com" -ForegroundColor White
Write-Host "   - Sign in to your account" -ForegroundColor White
Write-Host "   - Go to Settings > API Keys" -ForegroundColor White
Write-Host "   - Generate or copy your API key" -ForegroundColor White
Write-Host ""
Write-Host "2. Configure it in Cursor:" -ForegroundColor Yellow
Write-Host "   Option A - Through Cursor UI:" -ForegroundColor White
Write-Host "   - Open Cursor Settings (Ctrl+,)" -ForegroundColor White
Write-Host "   - Search for 'MCP' or 'Model Context Protocol'" -ForegroundColor White
Write-Host "   - Find TestSprite in the MCP Servers list" -ForegroundColor White
Write-Host "   - Add your API key in the environment variables section" -ForegroundColor White
Write-Host ""
Write-Host "   Option B - Manual configuration file:" -ForegroundColor White
Write-Host "   - The MCP config is typically in:" -ForegroundColor White
Write-Host "     %APPDATA%\Cursor\User\globalStorage\mcp.json" -ForegroundColor Gray
Write-Host "   - Or check Cursor's settings for MCP configuration" -ForegroundColor White
Write-Host ""
Write-Host "3. Restart Cursor after configuration" -ForegroundColor Yellow
Write-Host ""

# Ask if user wants to set API key now
$apiKey = Read-Host "Do you have a TestSprite API key? Enter it now (or press Enter to skip)"
if ($apiKey -and $apiKey.Trim() -ne "") {
    Write-Host ""
    Write-Host "⚠️  Note: API key configuration in Cursor must be done through the UI" -ForegroundColor Yellow
    Write-Host "   The API key you entered: $($apiKey.Substring(0, [Math]::Min(10, $apiKey.Length)))..." -ForegroundColor Gray
    Write-Host "   Please add this to Cursor's MCP settings manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host "After configuring the API key and restarting Cursor, TestSprite should be ready to use!" -ForegroundColor Green

