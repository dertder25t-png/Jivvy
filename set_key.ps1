$ErrorActionPreference = "Stop"

# Read private key from .env.local
$content = Get-Content .env.local -Raw
if ($content -match 'JWT_PRIVATE_KEY="([^"]+)"') {
    $privateKey = $matches[1]
    Write-Host "Found Private Key. Setting..."
    
    # Use Invoke-Expression or direct execution
    # npx convex env set JWT_PRIVATE_KEY "$privateKey"
    # We need to be careful with quotes in the key? The key is base64-like but has spaces and dashes.
    # It shouldn't have quotes inside.
    
    $proc = Start-Process -FilePath "npx.cmd" -ArgumentList "convex", "env", "set", "JWT_PRIVATE_KEY", "$privateKey" -NoNewWindow -PassThru -Wait
    
    if ($proc.ExitCode -eq 0) {
        Write-Host "Successfully set JWT_PRIVATE_KEY"
    } else {
        Write-Host "Failed to set JWT_PRIVATE_KEY with exit code $($proc.ExitCode)"
    }
} else {
    Write-Error "Could not find JWT_PRIVATE_KEY in .env.local"
}
