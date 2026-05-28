# 🏦 NexaBank — Cloud-Native Banking Platform on AWS

> A production-grade, multi-tier digital banking application deployed on AWS using EC2, ALB, Auto Scaling Groups, RDS PostgreSQL, Secrets Manager, SSM, and CloudWatch — following a microservices architecture with path-based routing, private networking, and zero hardcoded credentials.

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [AWS Services Used](#3-aws-services-used)
4. [VPC & Networking](#4-vpc--networking)
5. [Compute — EC2 & Auto Scaling Groups](#5-compute--ec2--auto-scaling-groups)
6. [Load Balancing — ALB with Path-Based Routing](#6-load-balancing--alb-with-path-based-routing)
7. [Database — Amazon RDS PostgreSQL](#7-database--amazon-rds-postgresql)
8. [Secrets & Configuration Management](#8-secrets--configuration-management)
9. [Remote Management — AWS Systems Manager](#9-remote-management--aws-systems-manager)
10. [Monitoring — Amazon CloudWatch](#10-monitoring--amazon-cloudwatch)
11. [DNS & SSL — Route 53 + ACM](#11-dns--ssl--route-53--acm)
12. [Bootstrap Process — How Instances Configure Themselves](#12-bootstrap-process--how-instances-configure-themselves)
13. [Microservices Architecture](#13-microservices-architecture)
14. [Security Design](#14-security-design)
15. [Key Bugs Found & Fixed](#15-key-bugs-found--fixed)
16. [Repository Structure](#16-repository-structure)
17. [Environment Variables Reference](#17-environment-variables-reference)
18. [Deployment Guide](#18-deployment-guide)
19. [Cleanup](#19-cleanup)

---

## 1. Project Overview

NexaBank is a full-stack digital banking platform built with a **microservices architecture** and deployed entirely on AWS. It allows users to:

- Register and log in with JWT-based authentication
- Create bank accounts
- Deposit, withdraw, and transfer money between accounts
- View transaction history

The platform runs across **4 EC2 instances** (one per service), all behind a **single Application Load Balancer (ALB)** that routes traffic based on URL path. All instances are in **private subnets** with no public IPs — accessible only through the ALB (for web traffic) or AWS SSM (for administration).

| Service | Port | Technology |
|---|---|---|
| User Service | 3001 | Node.js + Express + PostgreSQL |
| Account Service | 3002 | Node.js + Express + PostgreSQL |
| Transaction Service | 3003 | Node.js + Express + PostgreSQL |
| Frontend | 80 | React (SPA) served by Nginx |

**Live Domain:** `https://ustbiteshub.online`

---

## 2. Architecture Diagram

```
                        INTERNET
                           │
                           │ HTTPS (443)
                           ▼
                    ┌─────────────┐
                    │  Route 53   │  ustbiteshub.online → ALB IPs
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     ACM     │  SSL Certificate for ustbiteshub.online
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │  Application Load       │  nexbank-lb
              │  Balancer (ALB)         │  Public Subnets (2 AZs)
              │  nexabank-alb-sg        │  Ports: 80 → redirect, 443 → route
              └─┬──────┬──────┬──────┬─┘
                │      │      │      │
         /api/  │  /api/│  /api/│  default
         users* │account*│trans*│      │
                │      │      │      │
         ┌──────▼─┐ ┌──▼───┐ ┌▼─────┐ ┌▼──────┐
         │  User  │ │Acct  │ │Trans │ │Front  │  ← Private App Subnets
         │  Svc   │ │Svc   │ │Svc   │ │end    │    (no public IPs)
         │:3001   │ │:3002 │ │:3003 │ │:80    │
         │EC2     │ │EC2   │ │EC2   │ │EC2    │
         │nexabank│ │nexabank-ec2-sg (all 4 use same SG)   │
         └───┬────┘ └──┬───┘ └──┬───┘ └───────┘
             │         │        │
             └────┬────┘        │
                  │             │ (internal call via ALB)
                  ▼             │
         ┌────────────────┐     │
         │  RDS PostgreSQL│◄────┘
         │  nexabank-rds-sg│
         │  Private DB     │
         │  Subnets (2 AZs)│
         │  Multi-AZ       │
         └────────────────┘

     ┌──────────────────────────────────────────┐
     │           AWS Supporting Services        │
     │                                          │
     │  Secrets Manager → DB creds, JWT, API key│
     │  SSM Parameter Store → ALB domain        │
     │  SSM Run Command → Remote management     │
     │  CloudWatch → Logs + Metrics             │
     │  S3 → Build artifacts, CW configs        │
     └──────────────────────────────────────────┘
```

---

## 3. AWS Services Used

### 3.1 Amazon EC2 (Elastic Compute Cloud)
**What it is:** Virtual servers in the AWS cloud.

**Why we used it:** EC2 gives full control over the server environment. Each microservice runs on a dedicated EC2 instance (Ubuntu Linux), making it easy to scale, debug, and monitor independently. Each instance runs the Node.js application as a `systemd` service.

**Instance details:**
- OS: Ubuntu (via custom AMI)
- Type: `t3.medium` (2 vCPU, 4GB RAM)
- Each instance has **no public IP** (private subnet only)
- Managed remotely via SSM (no SSH keys needed)

### 3.2 Application Load Balancer (ALB)
**What it is:** A layer-7 (HTTP/HTTPS-aware) load balancer that routes traffic based on URL path.

**Why we used it:** With 4 services behind a single domain, the ALB acts as the intelligent traffic director. Instead of exposing each service on a different port or domain, all traffic enters through one HTTPS endpoint and gets routed based on the URL path. This gives us a clean, unified API surface.

### 3.3 Auto Scaling Groups (ASG)
**What it is:** AWS service that automatically maintains a desired number of EC2 instances and replaces failed ones.

**Why we used it:** High availability without manual intervention. If the user-service EC2 crashes at 3am, the ASG detects the unhealthy instance (via ALB health checks), terminates it, and launches a fresh replacement from the AMI automatically.

### 3.4 Amazon Machine Images (AMI)
**What it is:** A snapshot/template of an EC2 instance that can be used to launch identical instances.

**Why we used it:** Each service is baked into a custom AMI containing the OS, Node.js runtime, application code, CloudWatch agent, and bootstrap script. When ASG needs to launch a new instance, it uses this AMI as the blueprint — ensuring consistency across launches.

### 3.5 Amazon RDS (Relational Database Service)
**What it is:** A managed database service that handles backups, patching, and Multi-AZ failover automatically.

**Why we used it:** Instead of managing PostgreSQL on an EC2 instance ourselves, RDS handles all the operational overhead. We use Multi-AZ deployment so if the primary DB instance fails, RDS automatically fails over to the standby replica in another Availability Zone — zero data loss.

### 3.6 AWS Secrets Manager
**What it is:** A secure, encrypted vault for sensitive configuration values.

**Why we used it:** Database passwords, JWT signing secrets, and internal API keys must never appear in source code or environment files committed to Git. Secrets Manager stores all sensitive values encrypted. Instances fetch them at boot time via the bootstrap script.

### 3.7 AWS Systems Manager (SSM) Parameter Store
**What it is:** A hierarchical key-value store for configuration values (non-sensitive).

**Why we used it:** The ALB domain name (`ustbiteshub.online`) is stored here so all instances can read it at boot. If the domain ever changes, only one SSM parameter needs updating — all instances pick up the change on next restart. No code changes needed.

### 3.8 AWS Systems Manager (SSM) Run Command
**What it is:** Lets you run shell commands on EC2 instances without SSH keys or open ports.

**Why we used it:** All 4 EC2 instances are in private subnets with no public IPs and port 22 (SSH) closed. SSM Run Command allows us to push configs, restart services, and edit files remotely — with a full audit trail of every command run.

### 3.9 Amazon CloudWatch
**What it is:** AWS's native monitoring service for logs, metrics, and alarms.

**Why we used it:** Centralized log aggregation from all 4 services without deploying any extra infrastructure. CloudWatch Agent on each instance reads from log files and ships them to CloudWatch Log Groups. Custom metrics (CPU, Memory, Disk) are published to custom namespaces.

### 3.10 Amazon S3 (Simple Storage Service)
**What it is:** Object storage — like a folder in the cloud accessible from anywhere with AWS credentials.

**Why we used it:** Used as a staging area to transfer files to EC2 instances via SSM (since you can't directly push files via SSM). CloudWatch agent configs and deployment scripts were uploaded to S3 then downloaded by instances.

### 3.11 Amazon Route 53
**What it is:** AWS's DNS (Domain Name System) service.

**Why we used it:** The domain `ustbiteshub.online` is hosted in Route 53 with an A record pointing to the ALB's IP addresses. When a user types the URL in a browser, Route 53 resolves it to the ALB.

### 3.12 AWS Certificate Manager (ACM)
**What it is:** Provides free SSL/TLS certificates for your AWS resources.

**Why we used it:** The ALB's HTTPS listener requires a valid SSL certificate. ACM issued a certificate for `ustbiteshub.online` for free and automatically handles renewal. The certificate is attached to the ALB — the browser sees a valid padlock without any cost.

### 3.13 Amazon ElastiCache (Redis)
**What it is:** Managed in-memory caching service.

**Status:** Provisioned but not actively used in the final architecture. The Redis cluster (`nexabank-redis`) was created but the services don't implement caching in the current version.

### 3.14 IAM (Identity and Access Management)
**What it is:** AWS's permission system.

**Why we used it:** EC2 instances need an IAM Role (`nexabank-ec2-role`) with specific policies attached so they can:
- Call Secrets Manager to fetch credentials
- Call SSM Parameter Store to fetch config
- Send logs and metrics to CloudWatch
- Use SSM Run Command (SSM Agent needs permissions)

The role is attached to the EC2 instance profile — no hardcoded AWS credentials needed on the instances.

---

## 4. VPC & Networking

### 4.1 VPC Overview
```
VPC Name: Banking-Nexus-vpc
VPC ID:   vpc-0e063affe7da105c0
CIDR:     10.0.0.0/16  (65,534 usable IPs)
Region:   us-east-1 (N. Virginia)
AZs Used: us-east-1a, us-east-1b
```

The entire application lives inside this private network. No resource is directly reachable from the internet except the ALB.

### 4.2 Three-Tier Subnet Architecture

We use a classic **3-tier subnet model** for maximum security isolation:

#### TIER 1 — Public Subnets (Internet-Facing)
| Name | CIDR | AZ | Contains |
|---|---|---|---|
| Banking-Nexus-public1-us-east-1a | 10.0.0.0/20 | us-east-1a | NAT Gateway |
| Banking-Nexus-public2-us-east-1b | 10.0.16.0/20 | us-east-1b | NAT Gateway |

- The **ALB** spans both public subnets (it's multi-AZ by nature)
- **NAT Gateways** sit here with public Elastic IPs
- Internet Gateway is attached to this tier
- Resources here ARE reachable from the internet

#### TIER 2 — Private App Subnets (EC2 Instances)
| Name | CIDR | AZ | Contains |
|---|---|---|---|
| app-Nexus-subnet-private3-us-east-1a | 10.0.160.0/20 | us-east-1a | Account Service EC2 (10.0.174.213) |
| app-Nexus-subnet-private4-us-east-1b | 10.0.176.0/20 | us-east-1b | User, Transaction, Frontend EC2s |

- **No public IPs** on any EC2 instance
- Outbound internet access via NAT Gateway (for AWS API calls)
- Inbound access ONLY from the ALB (enforced by Security Group)

#### TIER 3 — Private DB Subnets (RDS)
| Name | CIDR | AZ | Contains |
|---|---|---|---|
| db-Nexus-subnet-private1-us-east-1a | 10.0.128.0/20 | us-east-1a | RDS Primary |
| db-Nexus-subnet-private2-us-east-1b | 10.0.144.0/20 | us-east-1b | RDS Standby (Multi-AZ) |

- **No internet route at all** (no 0.0.0.0/0 in route table)
- Accessible ONLY from EC2 instances in the app tier
- Maximum security for database layer

### 4.3 Internet Gateway
- **ID:** igw-025af23c98ea7855f
- Attached to Banking-Nexus-vpc
- Allows the ALB and NAT Gateways to communicate with the internet

### 4.4 NAT Gateways
| ID | Public IP | AZ |
|---|---|---|
| nat-0a2565602e40a74fc | 34.193.1.99 | us-east-1a |
| nat-017a4e01b9f6e7c00 | 34.198.162.55 | us-east-1b |

**Why 2 NAT Gateways?** One per AZ for high availability. If the us-east-1a NAT Gateway goes down, the EC2 instances in us-east-1b can still make outbound calls via their own NAT Gateway. Each private subnet routes its 0.0.0.0/0 traffic to the NAT Gateway in the same AZ.

### 4.5 Route Tables
| Table | Subnet | Routes |
|---|---|---|
| Public RT | public1, public2 | 10.0.0.0/16 → local; 0.0.0.0/0 → IGW |
| App Private RT (AZ-a) | app-private3 | 10.0.0.0/16 → local; 0.0.0.0/0 → NAT-AZ-a |
| App Private RT (AZ-b) | app-private4 | 10.0.0.0/16 → local; 0.0.0.0/0 → NAT-AZ-b |
| DB Private RT | db-private1, db-private2 | 10.0.0.0/16 → local only |

### 4.6 Security Groups
Security Groups act as instance-level firewalls. They are **stateful** — replies to allowed inbound traffic are automatically allowed outbound.

#### `nexabank-alb-sg` — ALB Security Group
| Direction | Port | Source/Dest | Reason |
|---|---|---|---|
| Inbound | 80 | 0.0.0.0/0 | HTTP (redirected to HTTPS) |
| Inbound | 443 | 0.0.0.0/0 | HTTPS from any internet user |
| Outbound | 80 | nexabank-ec2-sg | ALB → Frontend |
| Outbound | 3001 | nexabank-ec2-sg | ALB → User Service |
| Outbound | 3002 | nexabank-ec2-sg | ALB → Account Service |
| Outbound | 3003 | nexabank-ec2-sg | ALB → Transaction Service |

#### `nexabank-ec2-sg` — All EC2 Instances
| Direction | Port | Source/Dest | Reason |
|---|---|---|---|
| Inbound | 80 | nexabank-alb-sg | Frontend: only from ALB |
| Inbound | 3001 | nexabank-alb-sg | User service: only from ALB |
| Inbound | 3002 | nexabank-alb-sg | Account service: only from ALB |
| Inbound | 3003 | nexabank-alb-sg | Transaction service: only from ALB |
| Outbound | 443 | 0.0.0.0/0 | AWS API calls (Secrets Manager, SSM, CloudWatch) via NAT |
| Outbound | 5432 | nexabank-rds-sg | PostgreSQL to RDS |

#### `nexabank-rds-sg` — RDS Database
| Direction | Port | Source/Dest | Reason |
|---|---|---|---|
| Inbound | 5432 | nexabank-ec2-sg | PostgreSQL: only from EC2 app tier |

---

## 5. Compute — EC2 & Auto Scaling Groups

### 5.1 EC2 Instances
All 4 instances use custom AMIs and run in private subnets:

| Instance ID | Service | Private IP | Subnet |
|---|---|---|---|
| i-067183936dbbe4c95 | User Service | 10.0.188.225 | app-private4-us-east-1b |
| i-0fd6f69939526e4f0 | Account Service | 10.0.174.213 | app-private3-us-east-1a |
| i-0c380c4fcd072ea32 | Transaction Service | 10.0.184.255 | app-private4-us-east-1b |
| i-0d3dd754c81ac9bd8 | Frontend (Nginx) | 10.0.188.132 | app-private4-us-east-1b |

### 5.2 Auto Scaling Groups
| ASG Name | Min | Desired | Max | Purpose |
|---|---|---|---|---|
| user | 1 | 1 | 3 | Auto-replace failed user-service instances |
| account | 1 | 1 | 3 | Auto-replace failed account-service instances |
| transaction | 1 | 1 | 3 | Auto-replace failed transaction-service instances |
| frontend | 1 | 1 | 2 | Auto-replace failed frontend instances |
| aii | 0 | 0 | 1 | AI service (not active) |

### 5.3 How ASG Health Checks Work
1. ALB sends `GET /health` to each instance every 30 seconds
2. If the instance returns `200 OK` → healthy
3. If it fails 3 times in a row → marked unhealthy
4. ASG terminates the unhealthy instance
5. ASG launches a new instance from the AMI
6. New instance runs `bootstrap.sh` and configures itself
7. New instance registers with the ALB target group
8. ALB starts sending traffic to the new instance

### 5.4 AMIs Used
All AMIs were built from running instances (`Create Image` → `No reboot` option):

| AMI Name | Service |
|---|---|
| user-banking / user-new | User Service |
| account-banking / account-new | Account Service |
| transaction-banking / transaction-new | Transaction Service |
| frontend-banking / Frontend-new | Frontend (Nginx + React) |

### 5.5 systemd Service Management
Each backend service runs as a `systemd` service for automatic start/restart:

```ini
# /etc/systemd/system/nexabank-user-service.service
[Unit]
Description=NexaBank User Service
After=network.target

[Service]
Type=simple
User=nexabank
WorkingDirectory=/opt/nexabank/user-service
EnvironmentFile=/etc/nexabank/user-service.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

# Log redirection (added for CloudWatch)
StandardOutput=append:/var/log/nexabank-user-service.log
StandardError=append:/var/log/nexabank-user-service.log

[Install]
WantedBy=multi-user.target
```

**Why systemd?** It automatically starts the service when the instance boots, restarts it if it crashes, and provides clean service lifecycle management.

**Log redirection:** We added a systemd drop-in file (`/etc/systemd/system/nexabank-user-service.service.d/logging.conf`) to redirect `stdout`/`stderr` to a log file. This was required because the CloudWatch Agent reads log files — it cannot directly read from the systemd journal in our configuration.

---

## 6. Load Balancing — ALB with Path-Based Routing

### 6.1 Listener Rules (HTTPS :443)
| Priority | Path Pattern | Target Group | Notes |
|---|---|---|---|
| 1 | `/api/users*` | nexabank-tg-user (port 3001) | User registration, login |
| 2 | `/api/accounts*` | nexabank-tg-account (port 3002) | Account management |
| 3 | `/api/transactions*` | nexabank-tg-transaction (port 3003) | Deposits, withdrawals, transfers |
| 4 | `/api/ai*` | nexabank-tg-ai (port 3004) | AI service |
| default | `*` | nexabank-frontend (port 80) | React SPA (all other routes) |

### 6.2 HTTP → HTTPS Redirect
The port 80 listener has a single rule: redirect all HTTP traffic to HTTPS with a `301 Moved Permanently` response. This ensures all traffic is encrypted.

### 6.3 Critical Bug Fixed — Path Pattern `/*` vs `*`

**The Bug:** ALB routing rules were configured as `/api/accounts/*` (with `/*` at the end).

**The Problem:** The `/*` pattern means "a forward slash followed by at least one character." The API endpoint `POST /api/accounts` (creating a new account) uses the exact path with NO trailing slash. This path did NOT match `/api/accounts/*`, so it fell through to the default rule → frontend nginx → **405 Method Not Allowed**.

**The Fix:** Changed all patterns from `/api/accounts/*` to `/api/accounts*` (just `*` at the end, no slash). The `*` wildcard matches zero or more characters, so it matches:
- `/api/accounts` ← the exact path (was broken before)
- `/api/accounts/my` ← with sub-path
- `/api/accounts/123/details` ← with ID

**Lesson:** In AWS ALB path patterns, `/*` ≠ `*`. Always use `*` for matching both exact paths and sub-paths.

### 6.4 Target Groups
Each target group does health checks:
```
Health check path:      /health
Healthy threshold:      3
Unhealthy threshold:    3
Interval:               30 seconds
```

---

## 7. Database — Amazon RDS PostgreSQL

### 7.1 Configuration
```
Engine:          PostgreSQL 15.7
Instance Class:  db.t3.medium
Storage:         20 GB gp3 (auto-scaling up to 1000 GB)
Multi-AZ:        Yes (standby in us-east-1b)
Encryption:      Yes (KMS)
Deletion Protection: Enabled (must disable before deleting)
```

### 7.2 Database-Per-Service Pattern
Each microservice has its **own isolated database**:

| Database | Owner Service | Contains |
|---|---|---|
| `users_db` | User Service | User accounts, hashed passwords, profiles |
| `accounts_db` | Account Service | Bank account numbers, balances, account status |
| `transactions_db` | Transaction Service | All transaction records (deposits, withdrawals, transfers) |

**Why separate databases?**
- **Independence:** A schema change in users_db cannot break the account service
- **Security:** Account service cannot accidentally query user passwords
- **Scalability:** Each DB can be scaled independently
- **Ownership:** Each team owns its own data store

### 7.3 Subnet Group
The RDS subnet group (`nexabank-rds-subnet-group`) spans both DB subnets:
- db-Nexus-subnet-private1-us-east-1a (10.0.128.0/20)
- db-Nexus-subnet-private2-us-east-1b (10.0.144.0/20)

Multi-AZ uses both subnets — primary in one AZ, standby in another. Automatic failover in case of AZ outage.

---

## 8. Secrets & Configuration Management

### 8.1 Secrets Manager — `nexabank/production`
```json
{
  "db_host":          "nexabank-postgres.cq7yqoyg4e2y.us-east-1.rds.amazonaws.com",
  "db_user":          "postgres",
  "db_password":      "<redacted>",
  "db_port":          "5432",
  "jwt_secret":       "banking_jwt",
  "internal_api_key": "<redacted-random-string>"
}
```

**Why Secrets Manager?**
- Values are **encrypted at rest** (AES-256)
- Access requires IAM permissions — stolen source code is useless without the right role
- Automatic rotation support
- Audit trail via CloudTrail

### 8.2 SSM Parameter Store
| Parameter | Value | Used By |
|---|---|---|
| `/nexabank/production/alb-dns` | `ustbiteshub.online` | Transaction service bootstrap (ACCOUNT_SERVICE_URL) |

**Why SSM for the domain?** If the domain changes, update one SSM parameter — all instances pick it up on next restart. No code change, no AMI rebuild.

### 8.3 Internal API Key
The transaction service needs to call the account service's internal endpoints (`/api/accounts/internal/credit`, `/api/accounts/internal/debit`) to move money. These endpoints must NOT be publicly callable.

**How it works:**
1. Transaction service sends request with header: `x-internal-key: <internal_api_key>`
2. Account service's `internalOnly` middleware checks this header
3. If header matches → allow request
4. If missing or wrong → return `403 Forbidden`

Both services fetch the same `internal_api_key` from Secrets Manager via bootstrap.

---

## 9. Remote Management — AWS Systems Manager

### 9.1 SSM Run Command
Since our EC2 instances are in private subnets with **no public IPs and SSH disabled**, we use SSM Run Command for all remote management tasks.

**How it works:**
1. SSM Agent runs as a service on each EC2 instance
2. Agent polls the SSM service via an HTTPS connection outbound (port 443 via NAT Gateway)
3. We send a command via AWS Console or CLI
4. SSM delivers the command to the agent
5. Agent runs it and returns output
6. Full audit trail stored in AWS

**We used SSM Run Command to:**
- Push CloudWatch agent configs to instances
- Edit service `.env` files (fix `ACCOUNT_SERVICE_URL`)
- Restart systemd services after config changes
- Add log file redirect drop-ins to systemd
- Check service logs and status
- Run diagnostic commands

**Why SSM over SSH?**
- No SSH keys to manage, rotate, or share
- Works with instances that have no public IP
- Port 22 never needs to be opened (smaller attack surface)
- Every command is logged for compliance

### 9.2 SSM VPC Endpoints
To let instances call SSM without going through the internet (via NAT Gateway), we provisioned VPC Interface Endpoints:
- `com.amazonaws.us-east-1.ssm` — SSM API
- `com.amazonaws.us-east-1.ssmmessages` — SSM session messaging
- `com.amazonaws.us-east-1.ec2messages` — EC2 message delivery
- `com.amazonaws.us-east-1.secretsmanager` — Secrets Manager
- `com.amazonaws.us-east-1.monitoring` — CloudWatch metrics
- `com.amazonaws.us-east-1.logs` — CloudWatch Logs

---

## 10. Monitoring — Amazon CloudWatch

### 10.1 Log Groups
| Log Group | Source | Content |
|---|---|---|
| `/nexabank/production/user-service` | User Service EC2 | All `console.log()` and error output |
| `/nexabank/production/account-service` | Account Service EC2 | All `console.log()` and error output |
| `/nexabank/production/transaction-service` | Transaction Service EC2 | All `console.log()` and error output |
| `/nexabank/production/frontend-access` | Frontend EC2 | Nginx access logs |
| `/nexabank/production/frontend-errors` | Frontend EC2 | Nginx error logs |

### 10.2 Custom Metrics Namespaces
Each service publishes metrics to its own CloudWatch namespace:

| Namespace | Instance | Metrics |
|---|---|---|
| `NexaBank/UserService` | User Service EC2 | CPU usage active/idle, Memory used %, Disk used % |
| `NexaBank/AccountService` | Account Service EC2 | CPU usage active/idle, Memory used %, Disk used % |
| `NexaBank/TransactionService` | Transaction Service EC2 | CPU usage active/idle, Memory used %, Disk used % |

### 10.3 CloudWatch Agent Configuration
Each service has a `cloudwatch-agent.json` that tells the agent what to collect:

```json
{
  "agent": {
    "run_as_user": "root",
    "logfile": "/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [{
          "file_path": "/var/log/nexabank-user-service.log",
          "log_group_name": "/nexabank/production/user-service",
          "log_stream_name": "{instance_id}",
          "timezone": "UTC"
        }]
      }
    },
    "force_flush_interval": 15
  },
  "metrics": {
    "namespace": "NexaBank/UserService",
    "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_active", "cpu_usage_idle"],
        "metrics_collection_interval": 60
      },
      "mem": {
        "measurement": ["mem_used_percent", "mem_available_percent"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "resources": ["/"],
        "metrics_collection_interval": 300
      }
    }
  }
}
```

### 10.4 Bugs Fixed in CloudWatch Setup

**Bug 1 — Invalid `journald` section:** The original config included a `journald` log collection section. CloudWatch Agent version 1.300067 does not support journald collection — this caused a silent JSON translation failure (`Cannot translate JSON, ERROR is exit status 1`). **Fix:** Removed the journald section, switched to file-based log collection.

**Bug 2 — Log files didn't exist:** Services logged to systemd journal only — the files `/var/log/nexabank-*.log` didn't exist. CloudWatch Agent was watching files that were never written to. **Fix:** Added systemd drop-in configs to redirect `stdout`/`stderr` to log files.

**Bug 3 — `AutoScalingGroupName` dimension:** The original config referenced `AutoScalingGroupName` as a metric dimension. This isn't supported in the agent version used. **Fix:** Removed the dimension.

---

## 11. DNS & SSL — Route 53 + ACM

### 11.1 Route 53
- Domain: `ustbiteshub.online`
- Hosted Zone managed in Route 53
- A Record: `ustbiteshub.online` → ALB (alias record pointing to nexbank-lb DNS name)
- When user types the URL, Route 53 returns the ALB's IP addresses

### 11.2 ACM Certificate
- Certificate issued for `ustbiteshub.online`
- Attached to the ALB's HTTPS listener (port 443)
- **Free** — ACM certificates for AWS resources have no cost
- Auto-renewal handled by ACM

### 11.3 Critical SSL Lesson
The ACM certificate is issued **for `ustbiteshub.online` only** — not for the raw ALB DNS name (`nexbank-lb-468687281.us-east-1.elb.amazonaws.com`).

When the transaction service was making internal calls using `http://nexbank-lb-...amazonaws.com`, two problems occurred:
1. HTTP (port 80) has no API routing rules on the ALB — all traffic goes to frontend
2. Even with HTTPS, the SSL certificate doesn't cover the ALB's raw DNS name

**Fix:** Changed `ACCOUNT_SERVICE_URL` to `https://ustbiteshub.online` in all service configurations.

---

## 12. Bootstrap Process — How Instances Configure Themselves

Every time a new EC2 instance starts (whether from ASG replacement or manual launch), it runs `bootstrap.sh` before the application starts. This is the key to our **zero-hardcoded-credentials** approach.

### 12.1 bootstrap.sh Step-by-Step (Transaction Service Example)

```bash
#!/bin/bash
set -euo pipefail

# ── STEP 1: Detect AWS Region ───────────────────────────────────────────────
# EC2 metadata service: only accessible from within an EC2 instance
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
AWS_REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/region)
# Result: AWS_REGION="us-east-1"

# ── STEP 2: Fetch All Secrets from Secrets Manager ──────────────────────────
SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "nexabank/production" \
  --region "${AWS_REGION}" \
  --query 'SecretString' \
  --output text)
# Result: SECRET='{"db_host":"...","db_password":"...","jwt_secret":"...",...}'

# ── STEP 3: Parse Individual Values from JSON Secret ────────────────────────
DB_HOST=$(echo "${SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin)['db_host'])")
DB_USER=$(echo "${SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin)['db_user'])")
DB_PASSWORD=$(echo "${SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin)['db_password'])")
JWT_SECRET=$(echo "${SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin)['jwt_secret'])")
INTERNAL_KEY=$(echo "${SECRET}" | python3 -c "import sys,json; print(json.load(sys.stdin)['internal_api_key'])")

# ── STEP 4: Fetch ALB Domain from SSM Parameter Store ───────────────────────
ALB_DNS=$(aws ssm get-parameter \
  --name "/nexabank/production/alb-dns" \
  --region "${AWS_REGION}" \
  --query 'Parameter.Value' \
  --output text)
# Result: ALB_DNS="ustbiteshub.online"

# ── STEP 5: Write Environment File ──────────────────────────────────────────
# This file is read by systemd when starting the Node.js service
cat > /etc/nexabank/transaction-service.env <<EOF
PORT=3003
NODE_ENV=production
AWS_REGION=${AWS_REGION}
DB_HOST=${DB_HOST}
DB_PORT=5432
DB_NAME=transactions_db
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
INTERNAL_API_KEY=${INTERNAL_KEY}
ACCOUNT_SERVICE_URL=https://${ALB_DNS}
EOF

# ── STEP 6: Secure the File ─────────────────────────────────────────────────
# Only root can read it — the passwords are in here
chmod 600 /etc/nexabank/transaction-service.env
chown root:root /etc/nexabank/transaction-service.env

echo "[bootstrap] Transaction service configured. Starting service..."
# systemd takes over from here and starts the Node.js process
```

### 12.2 Why This Approach is Superior

| Approach | Problem |
|---|---|
| Hardcoded in code | Anyone who sees the code sees the password |
| `.env` file committed to git | Password in git history forever |
| Hardcoded in AMI | Rotating passwords requires rebuilding AMI |
| **bootstrap.sh + Secrets Manager** | Credentials fetched fresh on every boot, never in code/git |

---

## 13. Microservices Architecture

### 13.1 Service Responsibilities

**User Service** (port 3001)
- `POST /api/users/register` — create new user account
- `POST /api/users/login` — authenticate and return JWT token
- `GET /api/users/profile` — get user profile (requires JWT)
- Writes to `users_db`

**Account Service** (port 3002)
- `POST /api/accounts` — create a new bank account
- `GET /api/accounts` — list user's accounts
- `GET /api/accounts/my` — get account details
- `POST /api/accounts/internal/credit` — add funds (internal only, x-internal-key required)
- `POST /api/accounts/internal/debit` — remove funds (internal only, x-internal-key required)
- Writes to `accounts_db`

**Transaction Service** (port 3003)
- `POST /api/transactions/deposit` — deposit money
- `POST /api/transactions/withdraw` — withdraw money
- `POST /api/transactions/transfer` — transfer between accounts
- `GET /api/transactions` — list transaction history
- Writes to `transactions_db`
- **Calls Account Service internally** to credit/debit accounts

**Frontend** (port 80)
- Serves the React Single Page Application (SPA)
- Nginx serves static files from `/usr/share/nginx/html/`
- All API calls go from the browser → ALB → microservices
- No server-side rendering

### 13.2 JWT Authentication Flow

```
1. User logs in:
   Browser → POST /api/users/login {email, password}
   → User Service verifies password (bcrypt)
   → Returns JWT token (signed with jwt_secret from Secrets Manager)

2. Authenticated request:
   Browser → GET /api/accounts (Authorization: Bearer <token>)
   → ALB routes to Account Service
   → Account Service verifies JWT signature using same jwt_secret
   → If valid: process request
   → If invalid/expired: 401 Unauthorized
```

### 13.3 Internal Service Communication

```
Browser → POST /api/transactions/deposit {amount: 500}
         → ALB → Transaction Service

Transaction Service:
  1. Verify user's JWT token
  2. Look up user's account in accounts_db (via Account Service or direct DB)
  3. Call: POST https://ustbiteshub.online/api/accounts/internal/credit
           Headers: x-internal-key: <internal_api_key>
           Body: {accountId: "...", amount: 500}
         → ALB → Account Service (internal endpoint)
  4. Account Service credits 500 to the account
  5. Transaction Service records the transaction in transactions_db
  6. Returns success to browser
```

---

## 14. Security Design

### 14.1 Defense-in-Depth Layers

```
Layer 1: Route 53 + ACM
  → HTTPS only, valid SSL certificate, encrypted in transit

Layer 2: ALB Security Group (nexabank-alb-sg)
  → Only ports 80 and 443 open from internet
  → All other ports blocked

Layer 3: EC2 in Private Subnets
  → No public IPs
  → No SSH port open
  → Internet cannot reach EC2 directly even if SG is misconfigured

Layer 4: EC2 Security Group (nexabank-ec2-sg)
  → Only accepts traffic from nexabank-alb-sg
  → Internet traffic rejected at SG level

Layer 5: RDS in Private DB Subnets
  → No internet route in DB subnet route table
  → nexabank-rds-sg: only accepts PostgreSQL from nexabank-ec2-sg
  → Database unreachable even from developers' laptops

Layer 6: Secrets Manager
  → Credentials never in code, config files, or git
  → Access requires IAM role attached to EC2 instance

Layer 7: Internal API Key
  → Service-to-service calls require x-internal-key header
  → Prevents users from directly calling internal credit/debit endpoints
```

### 14.2 IAM Least Privilege
The EC2 role (`nexabank-ec2-role`) has only the permissions needed:
- `secretsmanager:GetSecretValue` on specific secret ARN
- `ssm:GetParameter` on `/nexabank/production/*` parameters
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- `cloudwatch:PutMetricData`
- `ssm:DescribeAssociation`, `ssm:GetDeployablePatchSnapshotForInstance` (SSM Agent)

---

## 15. Key Bugs Found & Fixed

### Bug 1: ALB Path Pattern `/*` vs `*`
**Symptom:** `POST /api/accounts` returns `405 Method Not Allowed`
**Root Cause:** Rule `/api/accounts/*` doesn't match `/api/accounts` (no trailing slash content)
**Fix:** Changed to `/api/accounts*`

### Bug 2: Internal URL HTTP vs HTTPS
**Symptom:** `POST /api/transactions/deposit` returns `500 Internal Server Error`
**Root Cause:** `ACCOUNT_SERVICE_URL=http://nexbank-lb-....amazonaws.com` — HTTP goes to port 80 which has no API routing; even with HTTPS, the ACM cert doesn't cover the raw ALB DNS name
**Fix:** `ACCOUNT_SERVICE_URL=https://ustbiteshub.online`

### Bug 3: CloudWatch Agent JSON Translation Error
**Symptom:** CloudWatch Agent runs but no logs appear. Agent log shows `Cannot translate JSON, ERROR is exit status 1`
**Root Cause:** `cloudwatch-agent.json` contained a `journald` section and `AutoScalingGroupName` dimension — both unsupported in agent version 1.300067
**Fix:** Removed unsupported sections, switched to file-based log collection only

### Bug 4: Log Files Didn't Exist
**Symptom:** CloudWatch Agent config is valid but no logs appear in CloudWatch
**Root Cause:** Services only wrote to systemd journal. The file `/var/log/nexabank-*.log` being watched by the agent didn't exist
**Fix:** Added systemd drop-in `logging.conf` to redirect `StandardOutput` and `StandardError` to log files

### Bug 5: RDS Deletion Protection
**Symptom:** `aws rds delete-db-instance` fails with `Cannot delete protected DB Instance`
**Root Cause:** Deletion protection was enabled (good practice in production, forgot to disable before cleanup)
**Fix:** `aws rds modify-db-instance --no-deletion-protection --apply-immediately` before deleting

---

## 16. Repository Structure

```
demo/
├── README.md                          ← This file
├── learner.txt                        ← Beginner-friendly revision guide
│
├── services/
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── index.js               ← Express app entry point
│   │   │   ├── routes/                ← API route handlers
│   │   │   ├── middlewares/
│   │   │   │   └── auth.middleware.js ← JWT verification
│   │   │   └── models/                ← Sequelize DB models
│   │   ├── bootstrap.sh               ← Instance setup script (runs at boot)
│   │   ├── cloudwatch-agent.json      ← CW Agent config for this service
│   │   ├── Dockerfile                 ← (For local development)
│   │   └── package.json
│   │
│   ├── account-service/
│   │   ├── src/
│   │   │   ├── middlewares/
│   │   │   │   └── auth.middleware.js ← JWT + internalOnly middleware
│   │   │   └── routes/
│   │   │       └── accounts.routes.js ← Includes /internal/credit, /internal/debit
│   │   ├── bootstrap.sh
│   │   ├── cloudwatch-agent.json
│   │   └── package.json
│   │
│   ├── transaction-service/
│   │   ├── src/
│   │   │   └── routes/
│   │   │       └── transactions.routes.js ← Deposit/withdraw/transfer logic
│   │   ├── bootstrap.sh               ← Sets ACCOUNT_SERVICE_URL from SSM
│   │   ├── cloudwatch-agent.json
│   │   └── package.json
│   │
│   └── ai-service/                    ← Not active
│
├── frontend/
│   ├── src/
│   │   ├── index.css                  ← Light theme (updated)
│   │   ├── App.js
│   │   └── pages/
│   │       └── TransactionsPage.js    ← Deposit/withdraw UI
│   ├── bootstrap.sh                   ← Copies nginx config, verifies build files
│   ├── nginx.conf                     ← Nginx config for React SPA
│   └── package.json
│
└── work-2/                            ← Mirror repo (Banking-AMI)
    └── (same structure as above)
```

---

## 17. Environment Variables Reference

Each service reads from `/etc/nexabank/<service>.env` (written by bootstrap.sh):

### User Service
| Variable | Source | Value |
|---|---|---|
| `PORT` | Hardcoded | `3001` |
| `NODE_ENV` | Hardcoded | `production` |
| `DB_HOST` | Secrets Manager | RDS endpoint |
| `DB_PORT` | Hardcoded | `5432` |
| `DB_NAME` | Hardcoded | `users_db` |
| `DB_USER` | Secrets Manager | `postgres` |
| `DB_PASSWORD` | Secrets Manager | `<secret>` |
| `JWT_SECRET` | Secrets Manager | `banking_jwt` |

### Account Service
Same as User Service except `DB_NAME=accounts_db` and port `3002`

### Transaction Service
Same plus:

| Variable | Source | Value |
|---|---|---|
| `DB_NAME` | Hardcoded | `transactions_db` |
| `PORT` | Hardcoded | `3003` |
| `INTERNAL_API_KEY` | Secrets Manager | `<secret>` |
| `ACCOUNT_SERVICE_URL` | SSM Parameter | `https://ustbiteshub.online` |

---

## 18. Deployment Guide

### 18.1 Prerequisites
- AWS account with appropriate IAM permissions
- AWS CLI configured (`aws configure`)
- Domain registered and Route 53 hosted zone set up

### 18.2 One-Time Infrastructure Setup

**1. Create VPC with subnets (3-tier)**
```
VPC CIDR: 10.0.0.0/16
Public subnets: 10.0.0.0/20 (AZ-a), 10.0.16.0/20 (AZ-b)
App private subnets: 10.0.160.0/20 (AZ-a), 10.0.176.0/20 (AZ-b)
DB private subnets: 10.0.128.0/20 (AZ-a), 10.0.144.0/20 (AZ-b)
```

**2. Create Internet Gateway and NAT Gateways**
- Attach IGW to VPC
- Create NAT GW in each public subnet (with Elastic IP)
- Update route tables

**3. Create Security Groups**
- `nexabank-alb-sg`: inbound 80/443 from 0.0.0.0/0
- `nexabank-ec2-sg`: inbound 80/3001/3002/3003 from nexabank-alb-sg
- `nexabank-rds-sg`: inbound 5432 from nexabank-ec2-sg

**4. Create RDS**
```
Engine: PostgreSQL 15
Class: db.t3.medium
Multi-AZ: Yes
Subnet Group: DB private subnets
Security Group: nexabank-rds-sg
Deletion Protection: Enable
```

**5. Create Secrets Manager secret `nexabank/production`**
```json
{
  "db_host": "<your-rds-endpoint>",
  "db_user": "postgres",
  "db_password": "<your-password>",
  "jwt_secret": "banking_jwt",
  "internal_api_key": "<random-string>"
}
```

**6. Create SSM Parameter**
```bash
aws ssm put-parameter \
  --name "/nexabank/production/alb-dns" \
  --value "your-domain.com" \
  --type String
```

**7. Create IAM Role for EC2**
- Create role `nexabank-ec2-role`
- Attach policies: `CloudWatchAgentServerPolicy`, `AmazonSSMManagedInstanceCore`
- Add inline policy for Secrets Manager and SSM Parameter access

**8. Build AMIs**
- Launch EC2 in private subnet
- Install Node.js, deploy service code, install CW Agent
- Run bootstrap.sh to verify
- Create Image → no reboot

**9. Create ALB**
- Create ALB in public subnets with nexabank-alb-sg
- Create target groups for each service
- Configure HTTPS listener (port 443) with path rules
- Configure HTTP listener (port 80) to redirect to HTTPS
- Attach ACM certificate

**10. Create Auto Scaling Groups**
- One ASG per service using the corresponding AMI
- Min: 1, Desired: 1, Max: 3
- Attach to corresponding target group

**11. Configure Route 53**
- Create A record: your-domain.com → ALB (alias)

### 18.3 Updating a Service

```bash
# 1. Make code changes locally
# 2. Upload new tarball to S3
aws s3 cp user-service.tar.gz s3://your-bucket/user-service-latest.tar.gz

# 3. Run update command via SSM on the target instance
aws ssm send-command \
  --instance-ids i-0xxxxxxxxxxx \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["cd /opt/nexabank/user-service && ...", "sudo systemctl restart nexabank-user-service"]}'

# 4. Create new AMI for future ASG launches
# EC2 Console → Instance → Actions → Image → Create Image
```

---

## 19. Cleanup

To delete all resources (cost-saving), the correct deletion order is critical due to dependencies:

```
1. Delete Auto Scaling Groups (--force-delete)
2. Terminate EC2 Instances
3. Delete ALB
4. Delete Target Groups
5. Disable RDS deletion protection → Delete RDS instance
6. Delete ElastiCache (if provisioned)
7. Delete RDS Proxy (if provisioned)
8. Delete NAT Gateways
9. Delete VPC Endpoints
10. Release Elastic IPs
11. Delete AMIs + EBS snapshots
12. Delete Secrets Manager secrets (--force-delete-without-recovery)
13. Delete SSM Parameters
14. Empty + Delete S3 bucket
15. Delete CloudWatch Log Groups
16. Wait for RDS to fully delete (check status)
17. Delete RDS Subnet Group
18. Delete remaining network interfaces (ENIs)
19. Delete Subnets
20. Delete Security Groups
21. Delete non-main Route Tables
22. Detach + Delete Internet Gateway
23. Delete VPC
24. (Manual) Delete Route 53 hosted zone
25. (Manual) Delete ACM certificate
26. (Manual) Delete IAM roles
```

> ⚠️ **Note:** RDS and ElastiCache take 5-10 minutes to fully delete. VPC cannot be deleted until all ENIs, endpoints, and subnet group dependencies are cleared.

---

## 📚 Key Concepts Summary

| Concept | Our Usage |
|---|---|
| **VPC** | Isolated private network for the entire application |
| **Subnets** | 3-tier: public (ALB/NAT), private-app (EC2), private-db (RDS) |
| **Internet Gateway** | Entry/exit for public subnet internet traffic |
| **NAT Gateway** | Outbound internet for private EC2 instances (no inbound) |
| **Route Tables** | Traffic signposts — DB subnets have no internet route |
| **Security Groups** | Instance-level firewall — only ALB can talk to EC2, only EC2 can talk to RDS |
| **ALB** | Path-based routing of all HTTPS traffic to correct microservice |
| **ASG** | Auto-replace failed instances, maintain desired count |
| **AMI** | Baked instance template — launch identical instances instantly |
| **RDS Multi-AZ** | Automatic failover to standby DB in another AZ |
| **Secrets Manager** | Encrypted credential vault, fetched at boot — zero hardcoded secrets |
| **SSM Run Command** | Remote shell access without SSH keys or open ports |
| **SSM Parameter Store** | Non-sensitive config (domain name) — change once, all instances pick up |
| **CloudWatch Agent** | Ships logs and metrics from EC2 to CloudWatch — no extra infrastructure |
| **ACM** | Free SSL/TLS certificates, auto-renewing, attached to ALB |
| **Route 53** | DNS — maps domain name to ALB IP addresses |
| **systemd** | Linux service manager — auto-start, auto-restart, service lifecycle |
| **bootstrap.sh** | Instance self-configuration on boot — fetches secrets, writes .env |
| **JWT** | Stateless authentication tokens — issued by user service, verified by all services |
| **Internal API Key** | Service-to-service authentication — prevents public access to internal endpoints |

---

*Maintained by: NexaBank Engineering*
*Last Updated: May 2026*
