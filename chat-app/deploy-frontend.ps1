# deploy-frontend.ps1
$ErrorActionPreference = "Stop"

Write-Host "🔍 Checking gcloud configuration..."
$projectId = gcloud config get-value project 2>$null

if (-not $projectId) {
    Write-Error "❌ Project ID not found. Please run 'gcloud init' or 'gcloud config set project [YOUR_PROJECT_ID]'"
    exit 1
}

Write-Host "✅ Using Project ID: $projectId"

$imageName = "gcr.io/$projectId/chat-app-frontend"
$serviceName = "chat-app-frontend"
$region = "asia-east1" # Default to Taiwan/Asia, change if needed

Write-Host "🚀 Building container image..."
# Use gcloud builds submit to build in cloud (avoids local docker requirement issues)
gcloud builds submit --tag $imageName frontend/

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Build failed"
    exit 1
}

Write-Host "🚀 Deploying to Cloud Run..."
gcloud run deploy $serviceName `
    --image $imageName `
    --platform managed `
    --region $region `
    --allow-unauthenticated `
    --port 8080

if ($LASTEXITCODE -ne 0) {
    Write-Error "❌ Deployment failed"
    exit 1
}

Write-Host "✅ Deployment successful!"
