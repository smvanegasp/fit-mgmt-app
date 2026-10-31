# Email alerts: the API failing, and anyone getting the owner passcode wrong.
# Free at this size (CloudWatch's first 10 alarms and metrics, SNS's first 1,000 emails).

variable "alert_email" {
  description = "Where alerts go. Set it in infra/terraform.tfvars (git-ignored)."
  type        = string
}

resource "aws_sns_topic" "alerts" {
  name = "${local.name}-alerts"
}

# AWS emails a confirmation link first; alerts only arrive after it's clicked.
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

locals {
  # Logged by the API (backend/app/routers/session.py, routers/exercises.py).
  log_signals = {
    WrongOwnerPasscode = "\"Wrong owner passcode\""
    CueCheckFailed     = "\"Cue check failed\""
  }
}

resource "aws_cloudwatch_log_metric_filter" "signals" {
  for_each       = local.log_signals
  name           = each.key
  log_group_name = aws_cloudwatch_log_group.api.name
  pattern        = each.value

  metric_transformation {
    name          = each.key
    namespace     = "Fit"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "wrong_passcode" {
  alarm_name          = "${local.name}-wrong-owner-passcode"
  alarm_description   = "Someone entered a wrong owner passcode. Three in a row pause owner login on that network for up to an hour."
  namespace           = "Fit"
  metric_name         = "WrongOwnerPasscode"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  depends_on          = [aws_cloudwatch_log_metric_filter.signals]
}

resource "aws_cloudwatch_metric_alarm" "cue_check" {
  alarm_name          = "${local.name}-cue-check-failing"
  alarm_description   = "The cue check failed 3+ times in 15 minutes (Groq down, key revoked or spend limit hit)."
  namespace           = "Fit"
  metric_name         = "CueCheckFailed"
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  threshold           = 3
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  depends_on          = [aws_cloudwatch_log_metric_filter.signals]
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name}-api-errors"
  alarm_description   = "The API answered with 5 or more server errors in 5 minutes."
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = aws_apigatewayv2_api.api.id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${local.name}-api-crashing"
  alarm_description   = "The API function crashed or timed out (for example it can't start: missing SSM secret)."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.api.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
