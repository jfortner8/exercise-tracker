terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Same arrangement as archive-api and LocalLocatorAPI: state in a versioned, private, encrypted S3
  # bucket created once by hand (a configuration can't hold the state of the bucket that stores its own
  # state), with use_lockfile instead of a DynamoDB lock table. The state is the only record of what this
  # configuration owns, and it holds the Cognito app client's secret, which is why it's encrypted.
  backend "s3" {
    bucket       = "exercise-tracker-tfstate-816079797917"
    key          = "exercise-tracker/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "exercise-tracker"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
