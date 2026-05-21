# build-and-push.ps1 — Build and push all Docker images to Docker Hub
$ErrorActionPreference = "Stop"

Write-Host "`n==> Building and pushing all images to Docker Hub..." -ForegroundColor Cyan

docker build -t cazzzzz/banking-user-service:latest ./services/user-service
docker push cazzzzz/banking-user-service:latest
Write-Host "user-service pushed" -ForegroundColor Green

docker build -t cazzzzz/banking-account-service:latest ./services/account-service
docker push cazzzzz/banking-account-service:latest
Write-Host "account-service pushed" -ForegroundColor Green

docker build -t cazzzzz/banking-transaction-service:latest ./services/transaction-service
docker push cazzzzz/banking-transaction-service:latest
Write-Host "transaction-service pushed" -ForegroundColor Green

docker build -t cazzzzz/banking-frontend:latest ./frontend
docker push cazzzzz/banking-frontend:latest
Write-Host "frontend pushed" -ForegroundColor Green

Write-Host "`n==> All images pushed to Docker Hub successfully." -ForegroundColor Green
