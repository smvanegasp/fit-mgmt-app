# The FastAPI backend: the backend/Dockerfile "lambda" stage on Lambda, behind an HTTP API.

resource "aws_ecr_repository" "api" {
  name = "${local.name}-api"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the last 5 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 5 }
      action       = { type = "expire" }
    }]
  })
}

# scripts/deploy.sh pushes ":latest"; pinning the digest makes Lambda update when it changes.
data "aws_ecr_image" "api" {
  repository_name = aws_ecr_repository.api.name
  image_tag       = "latest"
}

# CloudFront sends this header to the API; the app refuses requests without it.
resource "random_password" "origin_secret" {
  length  = 40
  special = false
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name}-api"
  retention_in_days = 30
}

resource "aws_iam_role" "api" {
  name = "${local.name}-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "api" {
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.api.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem",
          "dynamodb:Query", "dynamodb:BatchWriteItem",
        ]
        Resource = aws_dynamodb_table.main.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.photos.arn}/*"
      },
      {
        # Without it S3 answers 403 instead of 404 for a missing photo.
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.photos.arn
      },
      {
        # SecureStrings use the AWS-managed aws/ssm key, whose policy already allows SSM use.
        Effect = "Allow"
        Action = "ssm:GetParametersByPath"
        # The path itself, trailing slash included, is what GetParametersByPath is checked against.
        Resource = "arn:aws:ssm:us-east-1:${local.account_id}:parameter${local.ssm_prefix}"
      },
    ]
  })
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name}-api"
  role          = aws_iam_role.api.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.api.repository_url}@${data.aws_ecr_image.api.image_digest}"
  architectures = ["x86_64"]
  memory_size   = 1024
  # API Gateway gives up at 30s; the cue check (an LLM call) usually takes a second or two.
  timeout = 30

  environment {
    variables = {
      TABLE_NAME           = aws_dynamodb_table.main.name
      PHOTOS_BUCKET        = aws_s3_bucket.photos.bucket
      SSM_PREFIX           = local.ssm_prefix
      ORIGIN_SECRET        = random_password.origin_secret.result
      COOKIE_SECURE        = "1"
      SANDBOX_LIMIT_PER_IP = "20"
      # Lambda Web Adapter: wait for uvicorn's port (the HTTP check would need the origin header).
      AWS_LWA_READINESS_CHECK_PROTOCOL = "tcp"
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.api.name
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # A ceiling for the whole API; per-IP and per-demo limits live in the app.
  default_route_settings {
    throttling_burst_limit = 50
    throttling_rate_limit  = 20
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*"
}
