# Adopts the resources the old CDK stack (CloudFormation "ExerciseTracker") created, instead of creating
# new ones. On the first apply Terraform reads each into state and changes nothing it doesn't have to.
# Once applied these blocks are no-ops; they can be deleted in any later change.

locals {
  # Cognito generates pool ids, so this one is written down. The Vercel role's policy uses it too.
  user_pool_id = "us-east-1_Qn070C54V"
}

import {
  to = aws_dynamodb_table.main
  id = "exercise-tracker"
}

import {
  to = aws_cognito_user_pool.users
  id = local.user_pool_id
}

import {
  to = aws_cognito_user_pool_client.web
  id = "${local.user_pool_id}/5489sa7uguvf40c4r8p14sdmm5"
}

import {
  to = aws_iam_openid_connect_provider.vercel
  id = "arn:aws:iam::816079797917:oidc-provider/oidc.vercel.com/john-90f0"
}

import {
  to = aws_iam_role.vercel
  id = "exercise-tracker-vercel"
}

import {
  to = aws_iam_role_policy.vercel
  id = "exercise-tracker-vercel:VercelRoleDefaultPolicy77548288"
}
