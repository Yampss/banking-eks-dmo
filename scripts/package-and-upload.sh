#!/bin/bash
# scripts/package-and-upload.sh
# Packages each service into a tarball and uploads to S3 for EC2 Image Builder.
# Run this from the project root before triggering Image Builder pipelines.
#
# Usage:
#   export AWS_REGION=us-east-1
#   export BUILD_BUCKET=nexabank-ami-builds
#   ./scripts/package-and-upload.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
BUILD_BUCKET="${BUILD_BUCKET:-nexabank-ami-builds}"
DIST_DIR="./dist"

mkdir -p "${DIST_DIR}"

echo "==> Packaging services for AMI build..."
echo "    S3 Bucket: s3://${BUILD_BUCKET}"

# ── Backend services ──────────────────────────────────────────────────────────
for SERVICE in user-service account-service transaction-service ai-service; do
  echo ""
  echo "==> Packaging ${SERVICE}..."

  TARBALL="${DIST_DIR}/${SERVICE}-latest.tar.gz"

  # Exclude node_modules (installed fresh in Image Builder) and any .env files
  tar -czf "${TARBALL}" \
    --exclude="node_modules" \
    --exclude=".env" \
    --exclude="*.log" \
    --exclude="dist" \
    -C "./services/${SERVICE}" .

  echo "    Uploading to s3://${BUILD_BUCKET}/${SERVICE}-latest.tar.gz ..."
  aws s3 cp "${TARBALL}" "s3://${BUILD_BUCKET}/${SERVICE}-latest.tar.gz" \
    --region "${AWS_REGION}"

  echo "    ✓ ${SERVICE} uploaded"
done

# ── Frontend: build React app and upload to frontend S3 bucket ────────────────
echo ""
echo "==> Building React frontend..."

FRONTEND_BUCKET=$(aws ssm get-parameter \
  --name "/nexabank/production/frontend-bucket" \
  --region "${AWS_REGION}" \
  --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -n "${FRONTEND_BUCKET}" ]; then
  cd ./frontend
  npm install
  REACT_APP_ENV=production npm run build
  cd ..

  echo "==> Uploading frontend to s3://${FRONTEND_BUCKET}..."
  aws s3 sync ./frontend/build/ "s3://${FRONTEND_BUCKET}/" \
    --delete \
    --region "${AWS_REGION}" \
    --cache-control "max-age=31536000,immutable" \
    --exclude "index.html"

  # index.html should NOT be cached — always fresh
  aws s3 cp ./frontend/build/index.html "s3://${FRONTEND_BUCKET}/index.html" \
    --region "${AWS_REGION}" \
    --cache-control "no-cache,no-store,must-revalidate"

  echo "==> Invalidating CloudFront cache..."
  CF_DIST_ID=$(aws ssm get-parameter \
    --name "/nexabank/production/cloudfront-dist-id" \
    --region "${AWS_REGION}" \
    --query 'Parameter.Value' --output text 2>/dev/null || echo "")

  if [ -n "${CF_DIST_ID}" ]; then
    aws cloudfront create-invalidation \
      --distribution-id "${CF_DIST_ID}" \
      --paths "/*"
    echo "    ✓ CloudFront cache invalidated"
  fi

  echo "    ✓ Frontend deployed"
else
  echo "    [SKIP] No frontend bucket configured. Set /nexabank/production/frontend-bucket in SSM."
fi

echo ""
echo "==> All services packaged and uploaded."
echo "    Now trigger EC2 Image Builder pipelines in the AWS Console."
