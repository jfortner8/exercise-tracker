# The roles GitHub Actions assumes through OIDC to plan and apply this configuration (see
# .github/workflows/infra.yml). Each run gets short-lived credentials, so no access keys exist anywhere.
#
#   exercise-tracker-ci-plan    read-only. Pull requests and main.
#   exercise-tracker-ci-apply   applies changes. Pushes to main only.
#
# They're separate on purpose: a pull request runs the workflow file from its own branch, so a role
# that could write and was trusted for pull requests would let anyone who can push a branch apply
# whatever they liked, unreviewed. Pull requests from forks get no OIDC token at all.
#
# The account's GitHub OIDC provider is shared with archive-api and LocalLocatorAPI, and owned by
# LocalLocatorAPI's configuration, so it's read here rather than managed.

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  account_id = data.aws_caller_identity.current.account_id
  # ARNs built from names rather than taken from the resources, so the policies below are fully known
  # at plan time and a reviewer sees exactly what they'll say.
  table_arn       = "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.name_prefix}"
  user_pool_arn   = "arn:aws:cognito-idp:${var.aws_region}:${local.account_id}:userpool/${local.user_pool_id}"
  vercel_issuer   = "oidc.vercel.com/${var.vercel_team_slug}"
  vercel_oidc_arn = "arn:aws:iam::${local.account_id}:oidc-provider/${local.vercel_issuer}"
  main_ref        = "${var.github_repo_subject}:ref:refs/heads/main"
  state_arn       = "arn:aws:s3:::${var.name_prefix}-tfstate-${local.account_id}"
}

data "aws_iam_policy_document" "github_assume" {
  for_each = {
    plan  = ["${var.github_repo_subject}:pull_request", local.main_ref]
    apply = [local.main_ref]
  }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value
    }
  }
}

# --- plan: `terraform plan` on pull requests. Read-only. ---

resource "aws_iam_role" "ci_plan" {
  name                 = "${var.name_prefix}-ci-plan"
  description          = "Read-only, for terraform plan in GitHub Actions."
  assume_role_policy   = data.aws_iam_policy_document.github_assume["plan"].json
  max_session_duration = 3600
}

# Same trade-off as the other two repositories: AWS's ReadOnlyAccess instead of a hand-kept list of the
# describe and list calls a plan makes. Broad read, no write.
resource "aws_iam_role_policy_attachment" "ci_plan_read" {
  role       = aws_iam_role.ci_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# --- apply: `terraform apply` on pushes to main. ---

resource "aws_iam_role" "ci_apply" {
  name                 = "${var.name_prefix}-ci-apply"
  description          = "terraform apply for exercise-tracker from GitHub Actions (main only)."
  assume_role_policy   = data.aws_iam_policy_document.github_assume["apply"].json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "ci_apply_read" {
  role       = aws_iam_role.ci_apply.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# Writes only to this project's resources. One honest caveat, as in LocalLocatorAPI: because it manages
# IAM roles named exercise-tracker-*, it could in principle edit its own permissions. That's what lets
# CI apply every change with no manual runs; the guard is that only main can assume it, so protect main.
data "aws_iam_policy_document" "ci_apply" {
  statement {
    sid       = "TerraformState"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.state_arn}/${var.name_prefix}/*"]
  }

  statement {
    sid       = "TerraformStateList"
    actions   = ["s3:ListBucket"]
    resources = [local.state_arn]
  }

  statement {
    sid       = "Table"
    actions   = ["dynamodb:*"]
    resources = [local.table_arn, "${local.table_arn}/*"]
  }

  # The provider asks for account-level limits while planning a table.
  statement {
    sid       = "TableLimits"
    actions   = ["dynamodb:DescribeLimits"]
    resources = ["*"]
  }

  statement {
    sid       = "UserPool"
    actions   = ["cognito-idp:*"]
    resources = [local.user_pool_arn]
  }

  statement {
    sid     = "Iam"
    actions = ["iam:*"]
    resources = [
      "arn:aws:iam::${local.account_id}:role/${var.name_prefix}-*",
      "arn:aws:iam::${local.account_id}:policy/${var.name_prefix}-*",
    ]
  }

  statement {
    sid       = "VercelOidcProvider"
    actions   = ["iam:*OpenIDConnectProvider*"]
    resources = [local.vercel_oidc_arn]
  }

  # Belt and braces on top of prevent_destroy and the workflow's refuse-to-destroy check: CI can never
  # delete the data or the sign-ins, whatever a merged change says. Deny always wins over Allow.
  statement {
    sid    = "NeverDeleteData"
    effect = "Deny"
    actions = [
      "dynamodb:DeleteTable",
      "dynamodb:DeleteBackup",
      "cognito-idp:DeleteUserPool",
      "cognito-idp:DeleteUserPoolClient",
      "cognito-idp:AdminDeleteUser",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ci_apply" {
  name   = "${var.name_prefix}-ci-apply"
  role   = aws_iam_role.ci_apply.id
  policy = data.aws_iam_policy_document.ci_apply.json
}
