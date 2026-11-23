variable "aws_region" {
  description = "Region every resource here lives in."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix for resource names."
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
