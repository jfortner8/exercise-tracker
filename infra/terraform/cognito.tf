# Sign-in. The website has its own sign-in pages and calls Cognito's API from the server
# (USER_PASSWORD_AUTH + SECRET_HASH), so there's no hosted UI or OAuth.

resource "aws_cognito_user_pool" "users" {
  name = "${var.name_prefix}-users"

  # People sign in with their email. Cognito's username for each user is then their sub, which is
  # what account deletion passes to AdminDeleteUser (apps/web/lib/auth/cognito-admin.ts).
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"

  # The user directory can't be recreated: passwords can't be exported, so losing it signs everyone out
  # for good. Cognito refuses to delete it while this is on, and Terraform refuses to plan its deletion.
  deletion_protection = "ACTIVE"

  password_policy {
    minimum_length                   = 10
    require_lowercase                = false
    require_numbers                  = false
    require_symbols                  = false
    require_uppercase                = false
    temporary_password_validity_days = 7
  }

  admin_create_user_config {
    allow_admin_create_user_only = !var.self_sign_up
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Exercise Tracker code"
    email_message        = "Your Exercise Tracker verification code is {####}"
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = "0"
      max_length = "2048"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name_prefix}-web"
  user_pool_id = aws_cognito_user_pool.users.id

  generate_secret                      = true
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH"]
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  allowed_oauth_flows_user_pool_client = false
  supported_identity_providers         = ["COGNITO"]
  auth_session_validity                = 3

  # An hour for ID and access tokens (the website only uses the ID token, once, at sign-in), 30 days for
  # refresh tokens.
  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 43200

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "minutes"
  }

  lifecycle {
    # A new client means a new client id and secret, and every Vercel environment would need them
    # changed at the same moment. Never replace it from CI.
    prevent_destroy = true
  }
}
