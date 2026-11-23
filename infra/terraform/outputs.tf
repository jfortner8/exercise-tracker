output "table_name" {
  description = "TABLE_NAME in Vercel."
  value       = aws_dynamodb_table.main.name
}

output "vercel_role_arn" {
  description = "APP_AWS_ROLE_ARN in Vercel."
  value       = aws_iam_role.vercel.arn
}

output "cognito_issuer" {
  description = "COGNITO_ISSUER in Vercel."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.users.id}"
}

output "cognito_client_id" {
  description = "COGNITO_CLIENT_ID in Vercel. The secret (COGNITO_CLIENT_SECRET) is in state only."
  value       = aws_cognito_user_pool_client.web.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.users.id
}
