# Banking App — EKS Deployment

Microservices banking application (frontend + 3 Node.js services + in-cluster Postgres) deployed on Amazon EKS.

## Architecture

| Component | Kind | Service type |
|-----------|------|-------------|
| frontend | Deployment | ClusterIP (behind ALB) |
| user-service | Deployment | ClusterIP |
| account-service | Deployment | ClusterIP |
| transaction-service | Deployment | ClusterIP |
| postgres | StatefulSet | ClusterIP |

Traffic enters through an **AWS ALB (internet-facing, HTTP)** managed by the AWS Load Balancer Controller.
Postgres data is persisted on **EBS gp3** via the AWS EBS CSI driver.

## Cluster Prerequisites

These must be installed on the EKS cluster before running the deploy script:

1. **AWS EBS CSI Driver**
   ```
   eksctl create addon --name aws-ebs-csi-driver --cluster <cluster-name> --region <region>
   ```
   Alternatively, enable via the EKS console: *Add-ons → AWS EBS CSI Driver*.

2. **AWS Load Balancer Controller**
   ```
   helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
     -n kube-system \
     --set clusterName=<cluster-name> \
     --set serviceAccount.create=false \
     --set serviceAccount.name=aws-load-balancer-controller
   ```
   Full guide: https://docs.aws.amazon.com/eks/latest/userguide/aws-load-balancer-controller.html

## Image Flow (Docker Hub — no ECR)

```bash
# Build and push all images
./build-and-push.sh
```

Images used:
- `cazzzzz/banking-user-service:latest`
- `cazzzzz/banking-account-service:latest`
- `cazzzzz/banking-transaction-service:latest`
- `cazzzzz/banking-frontend:latest`

## Deploy to EKS

```bash
# Ensure kubeconfig is set to your EKS cluster
aws eks update-kubeconfig --name <cluster-name> --region <region>

# Deploy everything
./k8s-deploy.sh
```

## Get the ALB address

```bash
kubectl get ingress -n banking
```

The `ADDRESS` column shows the ALB DNS name. It may take 1–3 minutes to provision.

## Manifest layout

```
k8s/
├── namespace.yaml              # banking namespace
├── storageclass.yaml           # EBS gp3 dynamic provisioner
├── configmap.yaml              # service config (DB host/port, inter-service URLs)
├── secrets.yaml                # DB password, JWT secret, internal API key
├── postgres-init-configmap.yaml# init script: creates users_db, accounts_db, transactions_db
├── postgres.yaml               # StatefulSet + ClusterIP service, EBS-backed PVC
├── user-service.yaml           # Deployment + ClusterIP service
├── account-service.yaml        # Deployment + ClusterIP service
├── transaction-service.yaml    # Deployment + ClusterIP service
├── frontend.yaml               # Deployment + ClusterIP service
└── ingress.yaml                # ALB ingress (internet-facing, HTTP)
```
