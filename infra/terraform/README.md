# Infrastructure (Terraform)

Everything the website needs in AWS (account 816079797917, us-east-1):

| File | What |
|---|---|
| `dynamodb.tf` | The `exercise-tracker` table: keys, the leaderboard index, TTL on `expiresAt`, point-in-time recovery, deletion protection |
| `cognito.tf` | The user pool (sign-in by email, codes by email) and the website's app client |
| `vercel.tf` | The OIDC provider for Vercel and the `exercise-tracker-vercel` role the website assumes, with its permissions |
| `ci.tf` | The two roles GitHub Actions assumes: `exercise-tracker-ci-plan` (read-only) and `exercise-tracker-ci-apply` |
| `imports.tf` | Adopts the resources the old CDK stack created (no-ops once applied) |

State is in `s3://exercise-tracker-tfstate-816079797917`, which is versioned, private and encrypted, the same arrangement as archive-api and LocalLocatorAPI.

## How changes reach AWS

Nobody runs `terraform apply` by hand. The `infra` workflow (`.github/workflows/infra.yml`) runs only when `infra/terraform/` changes:

- **Pull requests:** it checks formatting, validates, and posts a read-only plan as a comment. Read the plan before merging.
- **Merge to `main`:** it plans again and applies, unless the plan would delete or replace anything. Then it stops and applies nothing.
- **Every Monday:** it plans `main` and fails (GitHub emails you) if AWS no longer matches the code, for example after a change by hand in the console.

These guards keep the data safe, in layers:
- `prevent_destroy` on the table, the user pool and the app client.
- Deletion protection on the table and the pool in AWS itself.
- The workflow's refuse-to-delete check.
- An explicit `Deny` in the apply role on deleting the table, its backups, the pool, the client or any user.

The apply role can only write to this project's resources: the table, the pool, roles named `exercise-tracker-*`, and the Vercel OIDC provider. It's trusted only for pushes to `main`, so whoever can push to `main` can change the infrastructure. Keep `main` protected.

## One-time cutover from CDK

This happened once, when this configuration replaced the CDK stack (CloudFormation `ExerciseTracker`). It's recorded here for the history and in case it's ever needed again. CI can't create the roles it signs in with, so this is the only part not done by the workflow.

1. **State bucket:**
   ```bash
   B=exercise-tracker-tfstate-816079797917
   aws s3api create-bucket --bucket $B --region us-east-1
   aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
   aws s3api put-public-access-block --bucket $B --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-encryption --bucket $B --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```
2. **Retire the CDK stack but keep every resource.** Set `DeletionPolicy: Retain` on all of them, then delete the stack:
   ```bash
   aws cloudformation get-template --stack-name ExerciseTracker --template-stage Original --query TemplateBody > cdk.json
   jq '.Resources |= map_values(. + {DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain"})' cdk.json > retain.json
   aws cloudformation update-stack --stack-name ExerciseTracker --template-body file://retain.json \
     --parameters ParameterKey=BootstrapVersion,UsePreviousValue=true --capabilities CAPABILITY_NAMED_IAM
   aws cloudformation wait stack-update-complete --stack-name ExerciseTracker
   aws cloudformation delete-stack --stack-name ExerciseTracker
   aws cloudformation wait stack-delete-complete --stack-name ExerciseTracker
   ```
   Afterwards the table, pool, client, role, its policy and the Vercel provider must all still exist.
3. **Create only the CI roles:**
   ```bash
   terraform init
   terraform apply -target=aws_iam_role.ci_plan -target=aws_iam_role_policy_attachment.ci_plan_read \
     -target=aws_iam_role.ci_apply -target=aws_iam_role_policy_attachment.ci_apply_read -target=aws_iam_role_policy.ci_apply
   ```
4. **Tell the workflow which roles to use:**
   ```bash
   gh variable set AWS_PLAN_ROLE_ARN --body "$(terraform output -raw ci_plan_role_arn)"
   gh variable set AWS_APPLY_ROLE_ARN --body "$(terraform output -raw ci_apply_role_arn)"
   ```
5. **Re-run the pull request's `infra` workflow.** Its plan imports the six existing resources and changes nothing destructive. Merging applies it.
