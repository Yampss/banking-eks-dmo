# k8s-deploy.ps1 — Deploy banking app to EKS (PowerShell)
Set-Location $PSScriptRoot
Write-Host "Working directory: $PSScriptRoot" -ForegroundColor DarkGray

Write-Host "`n==> Applying namespace..." -ForegroundColor Cyan
kubectl apply -f k8s\namespace.yaml

Write-Host "`n==> Applying StorageClass..." -ForegroundColor Cyan
kubectl apply -f k8s\storageclass.yaml

Write-Host "`n==> Applying ConfigMaps and Secrets..." -ForegroundColor Cyan
kubectl apply -f k8s\postgres-init-configmap.yaml
kubectl apply -f k8s\configmap.yaml
kubectl apply -f k8s\secrets.yaml

Write-Host "`n==> Deploying Postgres..." -ForegroundColor Cyan
kubectl apply -f k8s\postgres.yaml

Write-Host "`n==> Waiting for Postgres to be ready (up to 3 min)..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=postgres -n banking --timeout=180s
Write-Host "PostgreSQL is ready!" -ForegroundColor Green

Write-Host "`n==> Deploying application services..." -ForegroundColor Cyan
kubectl apply -f k8s\user-service.yaml
kubectl apply -f k8s\account-service.yaml
kubectl apply -f k8s\transaction-service.yaml
kubectl apply -f k8s\frontend.yaml

Write-Host "`n==> Applying ALB Ingress..." -ForegroundColor Cyan
kubectl apply -f k8s\ingress.yaml

Write-Host "`n==> Done! Waiting 90s for ALB to provision..." -ForegroundColor Green
Start-Sleep -Seconds 90

Write-Host "`n==> Ingress (ALB address):" -ForegroundColor Cyan
kubectl get ingress -n banking

Write-Host "`n==> Pod status:" -ForegroundColor Cyan
kubectl get pods -n banking
