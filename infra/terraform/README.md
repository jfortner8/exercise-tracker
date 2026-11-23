# Infrastructure (Terraform)

Everything the website needs in AWS (account 816079797917, us-east-1):

| File | What |
|---|---|
| `dynamodb.tf` | The `exercise-tracker` table: keys, the leaderboard index, TTL on `expiresAt`, point-in-time recovery, deletion protection |
| `cognito.tf` | The user pool (sign-in by email, codes by email) and the website's app client |
| `vercel.tf` | The OIDC provider for Vercel and the `exercise-tracker-vercel` role the website assumes, with its permissions |

State is in `s3://exercise-tracker-tfstate-816079797917`, which is versioned, private and encrypted, the same arrangement as archive-api and LocalLocatorAPI.

## How changes reach AWS

Nobody runs `terraform apply` by hand. The `infra` workflow (`.github/workflows/infra.yml`) runs only when `infra/terraform/` changes:

- **Pull requests:** it checks formatting, validates, and posts a read-only plan as a comment. Read the plan before merging.
- **Merge to `main`:** it plans again and applies, unless the plan would delete or replace anything. Then it stops and applies nothing.
- **Every Monday:** it plans `main` and fails (GitHub emails you) if AWS no longer matches the code, for example after a change by hand in the console.

CI signs in to AWS as the account's shared `github-actions-runner` role (AdministratorAccess), through GitHub OIDC with no stored keys. The role is defined in archive-api's Terraform (`infra/terraform/ci.tf` there), which lists the repositories it trusts. Its ARN is set as the `AWS_PLAN_ROLE_ARN` and `AWS_APPLY_ROLE_ARN` repository variables.

These guards keep the data safe, in layers:
- `prevent_destroy` on the table, the user pool and the app client.
- Deletion protection on the table and the pool in AWS itself.
- The workflow's refuse-to-delete check.

## One-time cutover from CDK

This happened once, when this configuration replaced the CDK stack (CloudFormation `ExerciseTracker`). It's recorded here for the history.

1. **CI access:** archive-api's Terraform gained the single `github-actions-runner` role, trusted by this repository.
2. **State bucket:**
   ```bash
   B=exercise-tracker-tfstate-816079797917
   aws s3api create-bucket --bucket $B --region us-east-1
   aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
   aws s3api put-public-access-block --bucket $B --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
   aws s3api put-bucket-encryption --bucket $B --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
   ```
3. **Retire the CDK stack but keep every resource.** CDK set `Retain` only on the table and the pool, so deleting the stack as it was would have deleted the app client, the Vercel role, its policy and the OIDC provider. So first set `Retain` on everything, then delete the stack:
   ```bash
   aws cloudformation get-template --stack-name ExerciseTracker --template-stage Original --query TemplateBody > cdk.json
   jq '.Resources |= map_values(. + {DeletionPolicy: "Retain", UpdateReplacePolicy: "Retain"})' cdk.json > retain.json
   aws cloudformation update-stack --stack-name ExerciseTracker --template-body file://retain.json      --parameters ParameterKey=BootstrapVersion,UsePreviousValue=true --capabilities CAPABILITY_NAMED_IAM
   aws cloudformation wait stack-update-complete --stack-name ExerciseTracker
   aws cloudformation delete-stack --stack-name ExerciseTracker
   aws cloudformation wait stack-delete-complete --stack-name ExerciseTracker
   ```
   Afterwards the table, pool, client, role, its policy and the Vercel provider must all still exist.
4. **Repository variables:** `AWS_PLAN_ROLE_ARN` and `AWS_APPLY_ROLE_ARN`, both set to `arn:aws:iam::816079797917:role/github-actions-runner`.
5. **The pull request's plan** imported the six existing resources, and merging applied it.
