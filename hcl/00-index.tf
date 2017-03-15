# Configure the AWS Provider
provider "aws" {
  region = "us-east-1"
}

variable "LoggerLevel" {
  type = "string"
  default = "TRACE"
  description = "TODO"
}

variable "ResourcePrefix" {
  type = "string"
  description = "TODO"
}

variable "EmailDomain" {
  type = "string"
  #default = "test.com"
  description = "TODO"
}

variable "EmailPrefix" {
  type = "string"
  #default = "BackupConsole_"
  description = "TODO"
}

variable "SecondaryEmail" {
  type = "string"
  default = ""
  description = "TODO"
}

variable "SesRuleSet" {
  type = "string"
  #default = "default-ruleset"
  description = "TODO"
}

variable "MaxDequeue" {
  type = "string"
  default = "10"
  description = "Maximum number of queued backup results that can be retrieved per call of the queue consumer"
}

variable "QueueConsumerIntervalMinutes" {
  type = "string"
  default = "30"
  description = "Number of minutes between executions of the queue consumer lambda function"
}

variable "QueueConsumerTimeoutSeconds" {
  type = "string"
  default = "30"
  description = "Number of seconds before the queue consumer lambda function times out"
}

variable "QueueWorkerTimeoutSeconds" {
  type = "string"
  default = "30"
  description = "Number of seconds before the queue worker lambda function times out"
}

variable "QueueMetricStreamTimeoutSeconds" {
  type = "string"
  default = "300"
  description = "Number of seconds before the metrics DynamoDB Stream lambda function times out"
}

variable "ReceivingVerifyEmailTimeoutSeconds" {
  type = "string"
  default = "20"
  description = "Number of seconds before the lambda function that verifies backup results delivered via e-mail times out"
}

variable "ReceivingHTTPPostTimeoutSeconds" {
  type = "string"
  default = "20"
  description = "Number of seconds before the lambda function that handles backup results delivered via HTTP Post times out"
}

variable "LambdaLogRetention" {
  type = "string"
  default = "60"
  description = "Number of days you want to retain log events for lambda log groups"
}

variable "AppLogRetention" {
  type = "string"
  default = "365"
  description = "Number of days you want to retain log events for the app log group"
}

data "aws_region" "Current" {
  current = true
}

data "aws_caller_identity" "Current" {
}

data "template_file" "APIGatewayStageVersion" {
  template = "v3"
}

// Determine function names here to avoid cyclic dep between lambda and JSON
data "template_file" "IngestWorkerLambdaFunctionName" {
  template = "${var.ResourcePrefix}IngestWorkerLambda"
}

data "template_file" "LambdaConfigJSON" {
  template = <<EOF
{
  "LOGGER_LEVEL": ${jsonencode(var.LoggerLevel)},
  "RECEIVING_EMAIL_PREFIX": ${jsonencode(var.EmailPrefix)},
  "RECEIVING_EMAIL_DOMAIN": ${jsonencode(var.EmailDomain)},
  "INGEST_WORKER_MAX": ${jsonencode(var.MaxDequeue)},
  "INGEST_WORKER_MAX_TIME": ${jsonencode(var.QueueWorkerTimeoutSeconds)},
  "AWS_ACCOUNT_ID": ${jsonencode(data.aws_caller_identity.Current.account_id)},
  "AWS_REGION": ${jsonencode(data.aws_region.Current.name)},
  "AWS_RESOURCE_PREFIX": ${jsonencode(var.ResourcePrefix)},
  "AWS_RESOURCE_ATTR": {
    "aws_cloudwatch_log_group.AppLogGroup.id": ${jsonencode(aws_cloudwatch_log_group.AppLogGroup.id)},
    "aws_sqs_queue.ReceiveQueue.id": ${jsonencode(aws_sqs_queue.ReceiveQueue.id)},
    "aws_dynamodb_table.Client.name": ${jsonencode(aws_dynamodb_table.Client.name)},
    "aws_dynamodb_table.Backup.arn": ${jsonencode(aws_dynamodb_table.Backup.arn)},
    "aws_dynamodb_table.Backup.name": ${jsonencode(aws_dynamodb_table.Backup.name)},
    "aws_dynamodb_table.ClientMetric.name": ${jsonencode(aws_dynamodb_table.ClientMetric.name)},
    "aws_sns_topic.EmailReceiveTopic.arn": ${jsonencode(aws_sns_topic.EmailReceiveTopic.arn)},
    "aws_s3_bucket.ReceivingStorageBucket.id": ${jsonencode(aws_s3_bucket.ReceivingStorageBucket.id)},
    "aws_lambda_function.IngestWorkerLambda.function_name": ${jsonencode(data.template_file.IngestWorkerLambdaFunctionName.rendered)},
    "aws_api_gateway_resource.APIReceivingProxy.path": ${jsonencode(aws_api_gateway_resource.APIReceivingProxy.path)}
  }
}
EOF
}

output "account_id" {
  value = "${data.aws_caller_identity.Current.account_id}"
}

output "region" {
  value = "${data.aws_region.Current.name}"
}
