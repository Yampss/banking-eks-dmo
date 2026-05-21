#!/bin/bash
set -e

echo "Building and pushing all images to Docker Hub..."

docker build -t cazzzzz/banking-user-service:latest ./services/user-service
docker push cazzzzz/banking-user-service:latest
echo "user-service pushed"

docker build -t cazzzzz/banking-account-service:latest ./services/account-service
docker push cazzzzz/banking-account-service:latest
echo "account-service pushed"

docker build -t cazzzzz/banking-transaction-service:latest ./services/transaction-service
docker push cazzzzz/banking-transaction-service:latest
echo "transaction-service pushed"

docker build -t cazzzzz/banking-frontend:latest ./frontend
docker push cazzzzz/banking-frontend:latest
echo "frontend pushed"

echo ""
echo "All images pushed to Docker Hub successfully."
