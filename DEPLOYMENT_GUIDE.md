# Banking App — EKS Deployment Guide

Microservices banking application deployed on Amazon EKS with in-cluster Postgres, EBS-backed storage, and ALB ingress.

---

## Architecture Overview

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│  AWS Application Load Balancer  │  ← created by ALB Controller / Console
│  (internet-facing, HTTP:80)     │
└────────────────┬────────────────┘
                 │  routes by path
    ┌────────────┼────────────┐
    ▼            ▼            ▼ ▼
 /api/users  /api/accounts  /api/transactions  /
    │              │               │            │
user-svc     account-svc   transaction-svc  frontend
(ClusterIP)  (ClusterIP)    (ClusterIP)    (ClusterIP)
    │              │               │
    └──────────────┴───────────────┘
                   │
                   ▼
            postgres-0 (StatefulSet)
            EBS gp3 volume (5Gi, Retain)
```

| Component | Kind | Image |
|-----------|------|-------|
| frontend | Deployment × 2 | cazzzzz/banking-frontend:latest |
| user-service | Deployment × 2 | cazzzzz/banking-user-service:latest |
| account-service | Deployment × 2 | cazzzzz/banking-account-service:latest |
| transaction-service | Deployment × 2 | cazzzzz/banking-transaction-service:latest |
| postgres | StatefulSet × 1 | postgres:15-alpine |

---

## Cluster Prerequisites

### 1. EKS Cluster
This deployment was tested on **EKS Auto Mode** (Karpenter-managed nodes, `c6a.large`).

### 2. EBS CSI Driver
Enables dynamic EBS volume provisioning for Postgres.

> [!NOTE]
> On EKS Auto Mode the EBS CSI driver is built-in (`ebs.csi.eks.amazonaws.com`).
> On standard EKS, install it as an add-on:
> ```
> eksctl create addon --name aws-ebs-csi-driver --cluster <cluster-name> --region <region>
> ```

### 3. AWS Load Balancer Controller
Watches for Ingress objects and provisions ALBs automatically.

```bash
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=<cluster-name> \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=<region> \
  --set vpcId=<vpc-id>
```

Verify:
```bash
kubectl get pods -n kube-system | grep aws-load-balancer
# Both pods should show 1/1 Running
```

### 4. Subnet Tags (CRITICAL)
The ALB Controller needs to know which subnets to use. **Without these tags the ALB will never provision.**

```bash
# Tag all public subnets in your VPC:
aws ec2 create-tags \
  --region <region> \
  --resources <subnet-id-1> <subnet-id-2> <subnet-id-3> \
  --tags \
    Key=kubernetes.io/role/elb,Value=1 \
    Key=kubernetes.io/cluster/<cluster-name>,Value=shared
```

Verify tags:
```bash
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=<vpc-id>" \
  --query "Subnets[*].{ID:SubnetId,Tags:Tags}" \
  --region <region>
```

---

## Step 1 — Build & Push Docker Images

From inside the repo root on your local machine:

```bash
# Linux / Mac / Git Bash
./build-and-push.sh
```

```powershell
# Windows PowerShell
.\build-and-push.ps1
```

This builds and pushes 4 images to Docker Hub:
- `cazzzzz/banking-user-service:latest`
- `cazzzzz/banking-account-service:latest`
- `cazzzzz/banking-transaction-service:latest`
- `cazzzzz/banking-frontend:latest`

> [!NOTE]
> Run `docker login` first if not already authenticated with Docker Hub.

---

## Step 2 — Connect kubectl to EKS

```bash
aws eks update-kubeconfig --name <cluster-name> --region <region>
```

Verify:
```bash
kubectl get nodes
# All nodes should show Ready
```

---

## Step 3 — Deploy to EKS

### Option A: Script (Recommended)

```powershell
# Windows PowerShell / cmd — from repo root
.\k8s-deploy.ps1
```

```bash
# Linux / Mac / Git Bash
./k8s-deploy.sh
```

The script applies resources in this order:
1. Namespace (`banking`)
2. StorageClass (`ebs-gp3`)
3. ConfigMaps + Secrets
4. Postgres StatefulSet (waits until healthy)
5. Application services
6. ALB Ingress

---

### Option B: Manual kubectl (one at a time)

```cmd
kubectl apply -f k8s\namespace.yaml
kubectl apply -f k8s\storageclass.yaml
kubectl apply -f k8s\postgres-init-configmap.yaml
kubectl apply -f k8s\configmap.yaml
kubectl apply -f k8s\secrets.yaml
kubectl apply -f k8s\postgres.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n banking --timeout=180s
kubectl apply -f k8s\user-service.yaml
kubectl apply -f k8s\account-service.yaml
kubectl apply -f k8s\transaction-service.yaml
kubectl apply -f k8s\frontend.yaml
kubectl apply -f k8s\ingress.yaml
```

---

## Step 4 — ALB: Automatic vs Console

### Approach A — Automatic (what we did)

Applying `ingress.yaml` is all that's needed. The **AWS Load Balancer Controller** watches the cluster and calls the AWS API on your behalf:

```
kubectl apply -f k8s\ingress.yaml
        │
        ▼
ALB Controller reads the Ingress annotations
        │
        ▼
AWS API calls (automatic):
  ✓ Creates Application Load Balancer
  ✓ Creates Target Groups per backend service
  ✓ Creates HTTP:80 Listener + routing rules
  ✓ Registers pod IPs as targets
  ✓ Writes ALB DNS back to Ingress ADDRESS field
```

Get the ALB address:
```cmd
kubectl get ingress -n banking
```

| YAML annotation | AWS resource created |
|---|---|
| `ingressClassName: alb` | Triggers ALB Controller |
| `scheme: internet-facing` | Public-facing ALB |
| `target-type: ip` | Routes to pod IPs directly |
| `listen-ports: HTTP:80` | Listener on port 80 |
| Each `path:` rule | Target Group + Listener Rule |

> [!NOTE]
> Deleting the Ingress object (`kubectl delete -f k8s\ingress.yaml`) will also **delete the ALB** from AWS automatically.

---

### Approach B — Manual via AWS Console

If you prefer to create the ALB yourself in the console and skip `ingress.yaml`:

#### 1. Get the NodePort of each service
First change the services to NodePort so the ALB can reach them:
```cmd
kubectl edit svc user-service -n banking        # change type to NodePort
kubectl edit svc account-service -n banking
kubectl edit svc transaction-service -n banking
kubectl edit svc frontend -n banking
```
Note the NodePort assigned to each (30000–32767 range).

#### 2. Create Target Groups (one per service)
In **EC2 → Target Groups → Create target group**:
- Target type: `Instance`
- Protocol: `HTTP`
- Port: the NodePort from above
- VPC: your cluster VPC
- Health check path: `/health` (or `/` for frontend)
- Register all EKS worker nodes as targets

#### 3. Create the ALB
In **EC2 → Load Balancers → Create load balancer → Application**:
- Scheme: `Internet-facing`
- IP address type: `IPv4`
- VPC: your cluster VPC
- Subnets: select all public subnets (must be tagged)
- Security group: allow inbound HTTP:80 from `0.0.0.0/0`

#### 4. Configure Listener Rules
In the ALB → Listeners → HTTP:80 → View/edit rules:

| Priority | Path pattern | Forward to |
|----------|-------------|------------|
| 1 | `/api/users*` | user-service target group |
| 2 | `/api/accounts*` | account-service target group |
| 3 | `/api/transactions*` | transaction-service target group |
| Default | `/` (all other) | frontend target group |

#### 5. Test
Use the ALB DNS name from the console Description tab.

---

## Step 5 — Verify Deployment

```cmd
kubectl get pods -n banking
```
Expected — all `1/1 Running`:
```
NAME                                   READY   STATUS    RESTARTS   AGE
account-service-xxx                    1/1     Running   0          ...
account-service-xxx                    1/1     Running   0          ...
frontend-xxx                           1/1     Running   0          ...
frontend-xxx                           1/1     Running   0          ...
postgres-0                             1/1     Running   0          ...
transaction-service-xxx                1/1     Running   0          ...
transaction-service-xxx                1/1     Running   0          ...
user-service-xxx                       1/1     Running   0          ...
user-service-xxx                       1/1     Running   0          ...
```

```cmd
kubectl get ingress -n banking
```
The `ADDRESS` field shows your ALB DNS.

### API Health Checks
```bash
curl http://<ALB-DNS>/api/users/health
curl http://<ALB-DNS>/api/accounts/health
curl http://<ALB-DNS>/api/transactions/health
```

### Frontend
Open `http://<ALB-DNS>` in a browser.

---

## Troubleshooting Reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| `postgres-0` stuck `Pending` | Wrong StorageClass provisioner | Use `ebs.csi.eks.amazonaws.com` for Auto Mode |
| `postgres-0` CrashLoopBackOff | EBS `lost+found` dir blocks initdb | Set `PGDATA=/var/lib/postgresql/data/pgdata` |
| Services CrashLoopBackOff | Can't reach Postgres | Wait for postgres-0 to be `1/1`, then rollout restart |
| ALB ADDRESS never appears | Subnet tags missing | Tag subnets with `kubernetes.io/role/elb=1` |
| `Forbidden: updates to provisioner` | StorageClass provisioner is immutable | Delete and recreate the StorageClass |

### Useful debug commands
```cmd
kubectl describe pod <pod-name> -n banking
kubectl logs <pod-name> -n banking --previous
kubectl describe pvc -n banking
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=30
```

---

## Teardown

```cmd
kubectl delete namespace banking
kubectl delete storageclass ebs-gp3
```

> [!WARNING]
> The PVCs (EBS volumes) use `reclaimPolicy: Retain` — they will **not** be deleted automatically.
> Go to **EC2 → Volumes** in the AWS console and delete them manually to avoid ongoing charges.

> [!CAUTION]
> The ALB is deleted automatically when the `banking` namespace is removed (the Ingress object is deleted with it). Verify in **EC2 → Load Balancers** that it's gone.
