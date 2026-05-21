#!/bin/bash
set -e

# Apply namespace and cluster-level resources first
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/storageclass.yaml

# Apply ConfigMap and Secrets
kubectl apply -f k8s/postgres-init-configmap.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# Deploy Postgres and wait for it to be ready
kubectl apply -f k8s/postgres.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n banking --timeout=180s
echo "PostgreSQL is ready!"

# Deploy application services
kubectl apply -f k8s/user-service.yaml
kubectl apply -f k8s/account-service.yaml
kubectl apply -f k8s/transaction-service.yaml
kubectl apply -f k8s/frontend.yaml

# Apply ALB Ingress last (services must exist for target group registration)
kubectl apply -f k8s/ingress.yaml

echo ""
echo "All resources applied to namespace: banking"
echo "Run: kubectl get ingress -n banking   (to get the ALB address)"
