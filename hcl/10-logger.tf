resource "aws_cloudwatch_log_group" "AppLogGroup" {
  name = "${var.ResourcePrefix}AppLogs"
  retention_in_days = "${var.AppLogRetention}"
}
