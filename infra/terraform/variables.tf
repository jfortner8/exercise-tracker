variable "aws_region" {
  description = "Region every resource here lives in."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix for resource names. The CI apply role's write permissions are scoped to it."
  type        = string
  default     = "exercise-tracker"
}

variable "vercel_team_slug" {
  description = "Vercel team whose deployments may assume the app's AWS role (OIDC issuer oidc.vercel.com/<slug>)."
  type        = string
  default     = "john-90f0"
}

variable "vercel_project" {
  description = "Vercel project whose production and preview deployments may assume the app's AWS role."
  type        = string
  default     = "exercise-tracker"
}

variable "self_sign_up" {
  description = "Whether anyone can create an account at /signup. false closes sign-ups."
  type        = bool
  default     = true
}

variable "github_repo_subject" {
  description = <<-EOT
    The front of the `sub` claim in this repository's GitHub OIDC tokens. The account uses GitHub's
    immutable subject format (numeric owner and repository ids), so a plain `repo:owner/name` would
    never match. Read it with:
      gh api repos/jfortner8/exercise-tracker/actions/oidc/customization/sub
  EOT
  type        = string
  default     = "repo:jfortner8@160181019/exercise-tracker@1460270457"
}
