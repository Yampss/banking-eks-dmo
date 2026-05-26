#!/bin/bash
set -euo pipefail
SERVICE="transaction-service"
ENV_FILE="/etc/nexabank/${SERVICE}.env"
mkdir -p /etc/nexabank

TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
AWS_REGION=$(curl -s -H "X-aws-ec2-metadata-token: ${TOKEN}" "http://169.254.169.254/latest/meta-data/placement/region")

SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "nexabank/production" --region "${AWS_REGION}" \
  --query 'SecretString' --output text)

DB_HOST=$(echo "${SECRET}"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['db_host'])")
DB_USER=$(echo "${SECRET}"     | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['db_user'])")
DB_PASSWORD=$(echo "${SECRET}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['db_password'])")
JWT_SECRET=$(echo "${SECRET}"  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['jwt_secret'])")
INTERNAL_KEY=$(echo "${SECRET}"| python3 -c "import sys,json; d=json.load(sys.stdin); print(d['internal_api_key'])")

ALB_DNS=$(aws ssm get-parameter --name "/nexabank/production/alb-dns" --region "${AWS_REGION}" --query 'Parameter.Value' --output text 2>/dev/null || echo "localhost")

cat > "${ENV_FILE}" <<EOF
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

chmod 600 "${ENV_FILE}"
echo "[bootstrap] ${SERVICE} complete."
