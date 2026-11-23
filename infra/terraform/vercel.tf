# The role the website assumes from Vercel through OIDC federation: each deployment exchanges its
# Vercel-signed token for short-lived AWS credentials, so no AWS keys are stored anywhere.

locals {
  account_id = data.aws_caller_identity.current.account_id
  # ARNs built from names rather than taken from the resources, so the policies below are fully known
  # at plan time and a reviewer sees exactly what they'll say.
  table_arn       = "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.name_prefix}"
  user_pool_arn   = "arn:aws:cognito-idp:${var.aws_region}:${local.account_id}:userpool/${local.user_pool_id}"
  vercel_issuer   = "oidc.vercel.com/${var.vercel_team_slug}"
  vercel_oidc_arn = "arn:aws:iam::${local.account_id}:oidc-provider/${local.vercel_issuer}"
}

resource "aws_iam_openid_connect_provider" "vercel" {
  url             = "https://${local.vercel_issuer}"
  client_id_list  = ["https://vercel.com/${var.vercel_team_slug}"]
  thumbprint_list = ["ab9d0263244dd0326eb67015705a667e79cfe998"]
}

data "aws_iam_policy_document" "vercel_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.vercel_oidc_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.vercel_issuer}:aud"
      values   = ["https://vercel.com/${var.vercel_team_slug}"]
    }

    # Production and preview deployments of this project only.
    condition {
      test     = "StringLike"
      variable = "${local.vercel_issuer}:sub"
      values = [
        "owner:${var.vercel_team_slug}:project:${var.vercel_project}:environment:production",
        "owner:${var.vercel_team_slug}:project:${var.vercel_project}:environment:preview",
      ]
    }
  }
}

resource "aws_iam_role" "vercel" {
  name                 = "${var.name_prefix}-vercel"
  assume_role_policy   = data.aws_iam_policy_document.vercel_assume.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "vercel" {
  statement {
    sid = "Table"
    actions = [
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:ConditionCheckItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem",
    ]
    resources = [local.table_arn, "${local.table_arn}/index/*"]
  }

  # Deleting an account from the app also deletes its sign-in.
  statement {
    sid       = "DeleteSignIns"
    actions   = ["cognito-idp:AdminDeleteUser"]
    resources = [local.user_pool_arn]
  }
}

resource "aws_iam_role_policy" "vercel" {
  # The name CDK generated. Kept so the import adopts this policy instead of deleting it and creating a
  # renamed copy, which would leave the website without access for a moment.
  name   = "VercelRoleDefaultPolicy77548288"
  role   = aws_iam_role.vercel.id
  policy = data.aws_iam_policy_document.vercel.json
}
