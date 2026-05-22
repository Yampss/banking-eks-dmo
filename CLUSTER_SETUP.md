# EKS Cluster Setup Guide — Standard Mode (Manual / Custom Configuration)

This guide covers creating a production-ready EKS cluster **without Auto Mode**, using managed node groups with full control over IAM, networking, and add-ons. Follow all steps in order.

---

## Tools Required

Install these on your local machine before starting.

| Tool | Install |
|------|---------|
| AWS CLI v2 | https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html |
| kubectl | https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/ |
| eksctl | https://eksctl.io/installation/ |
| helm | https://helm.sh/docs/intro/install/ |

Configure AWS CLI with your credentials:
```cmd
aws configure
```
Enter: Access Key ID, Secret Access Key, region (`us-east-1`), output format (`json`).

Verify:
```cmd
aws sts get-caller-identity
```

---

## Part 1 — IAM Roles

You need four IAM roles. Create them in the **IAM Console → Roles → Create role**.

---

### Role 1: EKS Cluster Role

**Who uses it:** The EKS control plane itself.

**Console steps:**
1. IAM → Roles → **Create role**
2. Trusted entity: **AWS service**
3. Use case: **EKS** → **EKS - Cluster**
4. Permissions: `AmazonEKSClusterPolicy` (auto-attached)
5. Name: `eks-cluster-role`
6. Create role

**OR via CLI:**
```cmd
aws iam create-role --role-name eks-cluster-role --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"eks.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}"

aws iam attach-role-policy --role-name eks-cluster-role --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy
```

---

### Role 2: EKS Node Group Role

**Who uses it:** EC2 worker nodes in the node group.

**Console steps:**
1. IAM → Roles → **Create role**
2. Trusted entity: **AWS service**
3. Use case: **EC2**
4. Attach these 3 policies:
   - `AmazonEKSWorkerNodePolicy`
   - `AmazonEKS_CNI_Policy`
   - `AmazonEC2ContainerRegistryReadOnly`
5. Name: `eks-node-group-role`
6. Create role

**OR via CLI:**
```cmd
aws iam create-role --role-name eks-node-group-role --assume-role-policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"ec2.amazonaws.com\"},\"Action\":\"sts:AssumeRole\"}]}"

aws iam attach-role-policy --role-name eks-node-group-role --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
aws iam attach-role-policy --role-name eks-node-group-role --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
aws iam attach-role-policy --role-name eks-node-group-role --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```

---

### Role 3: EBS CSI Driver Role (IRSA)

**Who uses it:** The EBS CSI driver pod to call EC2 APIs and create volumes.

> [!IMPORTANT]
> This role uses **IRSA (IAM Roles for Service Accounts)** — the trust policy is set up AFTER the cluster exists (you need the OIDC issuer URL). See Part 4 for the full setup.

For now, just note you will create a role named `eks-ebs-csi-role` in Part 4.

---

### Role 4: AWS Load Balancer Controller Role (IRSA)

**Who uses it:** The ALB Controller pod to call EC2/ELB APIs and create load balancers.

> [!IMPORTANT]
> Same as above — set up in Part 4 after the cluster exists.

---

## Part 2 — VPC & Networking

### Option A: Use the Default VPC (quickest)

Find your default VPC:
```cmd
aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --region us-east-1
```

List its subnets:
```cmd
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<vpc-id>" --query "Subnets[*].{ID:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock}" --region us-east-1
```

**Tag the subnets** (required for ALB provisioning):
```cmd
aws ec2 create-tags --region us-east-1 ^
  --resources <subnet-1> <subnet-2> <subnet-3> ^
  --tags ^
    Key=kubernetes.io/role/elb,Value=1 ^
    Key=kubernetes.io/cluster/<cluster-name>,Value=shared
```

> [!NOTE]
> Replace `<subnet-1> <subnet-2> <subnet-3>` with all your subnet IDs separated by spaces.
> Replace `<cluster-name>` with the name you'll give your cluster (e.g. `banking-eks`).

---

### Option B: Create a Dedicated VPC (recommended for production)

Use eksctl to create the cluster with a new VPC automatically — it handles all networking. Skip this section and go straight to Part 3, Option B (eksctl).

Or create manually via **VPC Console → Create VPC → VPC and more**:
- IPv4 CIDR: `10.0.0.0/16`
- Availability zones: 2 or 3
- Public subnets: 1 per AZ (for ALB)
- Private subnets: 1 per AZ (for worker nodes — more secure)
- NAT gateways: 1 per AZ (or 1 for cost savings)
- Enable DNS hostnames: ✅
- Enable DNS resolution: ✅

Tag **public** subnets:
```
kubernetes.io/role/elb = 1
kubernetes.io/cluster/<cluster-name> = shared
```

Tag **private** subnets (if using private nodes):
```
kubernetes.io/role/internal-elb = 1
kubernetes.io/cluster/<cluster-name> = shared
```

---

## Part 3 — Create the EKS Cluster

### Option A: AWS Console (Manual)

1. Go to **EKS → Clusters → Create cluster**

2. **Cluster configuration:**
   - Name: `banking-eks`
   - Kubernetes version: `1.32` (latest stable)
   - Cluster service role: `eks-cluster-role` (created in Part 1)

3. **Networking:**
   - VPC: select your VPC
   - Subnets: select all public (and private if created)
   - Security groups: leave default
   - Cluster endpoint access: **Public and private** (recommended) or **Public**

4. **Logging** (optional but recommended for production):
   - Enable: API server, Audit, Authenticator

5. **Add-ons** — keep defaults (VPC CNI, CoreDNS, kube-proxy). We'll add EBS CSI in Part 4.

6. Click **Create** — takes 10–15 minutes.

---

### Option B: eksctl (Recommended — repeatable)

Create a cluster config file `cluster.yaml` in your repo:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: banking-eks
  region: us-east-1
  version: "1.32"

iam:
  withOIDC: true   # required for IRSA (EBS CSI + ALB Controller)

managedNodeGroups:
  - name: banking-nodes
    instanceType: t3.medium      # 2 vCPU, 4 GB RAM — fits all pods comfortably
    minSize: 2
    maxSize: 4
    desiredCapacity: 3
    volumeSize: 30               # GB per node
    volumeType: gp3
    iam:
      attachPolicyARNs:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
    tags:
      kubernetes.io/cluster/banking-eks: owned

vpc:
  clusterEndpoints:
    publicAccess: true
    privateAccess: true
```

Run:
```cmd
eksctl create cluster -f cluster.yaml
```

> [!NOTE]
> This takes 15–20 minutes. eksctl creates the VPC, subnets, NAT gateway, node group, and OIDC provider automatically.

After creation, eksctl automatically updates your kubeconfig:
```cmd
kubectl get nodes
# Should show 3 nodes in Ready state
```

---

### If you used Console (Option A) — update kubeconfig manually:
```cmd
aws eks update-kubeconfig --name banking-eks --region us-east-1
kubectl get nodes
```

---

## Part 4 — Install Add-ons

### 4.1 Enable OIDC Provider (required for IRSA)

> [!IMPORTANT]
> Skip this if you used eksctl with `withOIDC: true` — it's done automatically.

```cmd
eksctl utils associate-iam-oidc-provider --cluster banking-eks --region us-east-1 --approve
```

Get your OIDC issuer URL (you'll need it for IRSA roles):
```cmd
aws eks describe-cluster --name banking-eks --region us-east-1 --query "cluster.identity.oidc.issuer" --output text
```
Save this output — it looks like:
`https://oidc.eks.us-east-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B716D3041E`

---

### 4.2 EBS CSI Driver Add-on

#### Create the IAM Role for EBS CSI (IRSA)

Download the policy:
```cmd
curl -o ebs-csi-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-ebs-csi-driver/master/docs/example-iam-policy.json
```

Create the policy:
```cmd
aws iam create-policy --policy-name AmazonEBSCSIDriverPolicy --policy-document file://ebs-csi-policy.json
```

Create the IRSA role (replace `<account-id>` and `<oidc-id>`):
```cmd
eksctl create iamserviceaccount ^
  --name ebs-csi-controller-sa ^
  --namespace kube-system ^
  --cluster banking-eks ^
  --region us-east-1 ^
  --attach-policy-arn arn:aws:iam::<account-id>:policy/AmazonEBSCSIDriverPolicy ^
  --approve ^
  --override-existing-serviceaccounts
```

#### Install the Add-on

**Via Console:**
EKS → Clusters → `banking-eks` → Add-ons → **Get more add-ons** → search `EBS` → **Amazon EBS CSI Driver** → select the IAM role `eksctl-banking-eks-addon-iamserviceaccount-...` → Add

**Via CLI:**
```cmd
aws eks create-addon ^
  --cluster-name banking-eks ^
  --addon-name aws-ebs-csi-driver ^
  --region us-east-1 ^
  --service-account-role-arn arn:aws:iam::<account-id>:role/eksctl-banking-eks-addon-iamserviceaccou-Role1-XXXX
```

Verify:
```cmd
kubectl get pods -n kube-system | findstr ebs
```
Should show `ebs-csi-controller-xxx` pods Running.

---

### 4.3 AWS Load Balancer Controller

#### Create the IAM Policy

```cmd
curl -o alb-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json

aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://alb-policy.json
```

#### Create the IRSA Role

```cmd
eksctl create iamserviceaccount ^
  --cluster banking-eks ^
  --region us-east-1 ^
  --namespace kube-system ^
  --name aws-load-balancer-controller ^
  --attach-policy-arn arn:aws:iam::<account-id>:policy/AWSLoadBalancerControllerIAMPolicy ^
  --approve ^
  --override-existing-serviceaccounts
```

#### Install via Helm

```cmd
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller ^
  -n kube-system ^
  --set clusterName=banking-eks ^
  --set serviceAccount.create=false ^
  --set serviceAccount.name=aws-load-balancer-controller ^
  --set region=us-east-1 ^
  --set vpcId=<vpc-id>
```

Verify (both pods should reach `1/1 Running`):
```cmd
kubectl get pods -n kube-system | findstr aws-load-balancer
```

---

### 4.4 Tag Subnets (if not done in Part 2)

```cmd
aws ec2 create-tags --region us-east-1 ^
  --resources <subnet-1> <subnet-2> <subnet-3> ^
  --tags ^
    Key=kubernetes.io/role/elb,Value=1 ^
    Key=kubernetes.io/cluster/banking-eks,Value=shared
```

---

## Part 5 — Verify the Cluster

```cmd
kubectl get nodes
```
All nodes `Ready`.

```cmd
kubectl get pods -n kube-system
```
You should see:

| Pod | Expected |
|-----|----------|
| `coredns-xxx` × 2 | Running |
| `aws-node-xxx` × N | Running |
| `kube-proxy-xxx` × N | Running |
| `ebs-csi-controller-xxx` × 2 | Running |
| `ebs-csi-node-xxx` × N | Running |
| `aws-load-balancer-controller-xxx` × 2 | Running |

---

## Part 6 — Deploy the Banking App

> [!IMPORTANT]
> `storageclass.yaml` already uses `provisioner: ebs.csi.aws.com` — correct for standard EKS.
> (EKS Auto Mode uses `ebs.csi.eks.amazonaws.com` — do NOT use that here.)

```cmd
cd C:\Users\Admin\Desktop\work\demo

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

Check all pods:
```cmd
kubectl get pods -n banking
```

Get ALB address:
```cmd
kubectl get ingress -n banking
```

Open `http://<ADDRESS>` in your browser.

---

## Instance Type Guide

| Type | vCPU | RAM | Use case |
|------|------|-----|----------|
| `t3.small` | 2 | 2 GB | Testing only — too small for 5 services |
| `t3.medium` | 2 | 4 GB | ✅ Good for demo (recommended) |
| `t3.large` | 2 | 8 GB | Comfortable headroom |
| `t3a.medium` | 2 | 4 GB | Same as t3.medium, ~10% cheaper (AMD) |
| `m5.large` | 2 | 8 GB | Production baseline |

> [!TIP]
> For a demo with 9 pods (postgres + 6 service replicas + 2 frontend), **t3.medium × 3 nodes** is the sweet spot. Each node runs ~3 pods comfortably.

---

## Key Differences: Standard EKS vs Auto Mode

| | Standard EKS (this guide) | EKS Auto Mode |
|---|---|---|
| Node management | You manage node groups | AWS manages nodes via Karpenter |
| EBS CSI driver | Install as add-on (`ebs.csi.aws.com`) | Built-in (`ebs.csi.eks.amazonaws.com`) |
| StorageClass provisioner | `ebs.csi.aws.com` | `ebs.csi.eks.amazonaws.com` |
| IRSA setup | Manual (eksctl or console) | Simplified |
| Cost control | Full control over instance types | AWS selects instances |
| Node taints | You configure | Managed automatically |

---

## Teardown (avoid charges)

```cmd
kubectl delete namespace banking
kubectl delete storageclass ebs-gp3
```

> [!CAUTION]
> EBS volumes use `reclaimPolicy: Retain` — check **EC2 → Volumes** and delete leftover volumes manually.

Delete the cluster:
```cmd
eksctl delete cluster --name banking-eks --region us-east-1
```
Or via Console: EKS → Clusters → `banking-eks` → Delete.

> [!WARNING]
> Deleting the cluster does NOT automatically delete the IAM roles, policies, or EBS volumes you created manually. Clean those up in IAM → Roles and EC2 → Volumes.
