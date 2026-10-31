terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.69"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  # Created by infra/bootstrap. Native S3 lockfile, no DynamoDB lock table.
  backend "s3" {
    bucket       = "fit-tfstate-816940506502"
    key          = "fit/terraform.tfstate"
    region       = "us-east-1"
    profile      = "gym"
    encrypt      = true
    use_lockfile = true
  }
}

# Same AWS account as the pantry, fully separate stack: everything here is named fit-*.
provider "aws" {
  region  = "us-east-1"
  profile = "gym"
  default_tags {
    tags = { app = "fit" }
  }
}

data "aws_caller_identity" "current" {}

locals {
  name       = "fit"
  account_id = data.aws_caller_identity.current.account_id
  # Secrets live here as SecureStrings, put there by scripts/set_aws_secrets.py (never Terraform).
  ssm_prefix = "/fit/"
}
