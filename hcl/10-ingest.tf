# ========================================
# Ingest Consumer Lambda
# ========================================

resource "aws_lambda_function" "IngestConsumerLambda" {
  function_name = "${var.ResourcePrefix}IngestConsumerLambda"
  description = "TODO"
  role = "${aws_iam_role.IngestConsumerLambda_Role.arn}"
  handler = "lib/index/aws.ingestConsumerHandler"
  filename = "${path.module}/lambda_src.zip"
  source_code_hash = "${base64sha256(file("${path.module}/lambda_src.zip"))}"
  memory_size = 128
  timeout = "${var.QueueConsumerTimeoutSeconds}"
  runtime = "nodejs4.3"

  environment {
    variables {
      CONFIG = "${data.template_file.LambdaConfigJSON.rendered}"
    }
  }
}

resource "aws_cloudwatch_log_group" "IngestConsumerLambda_LogGroup" {
  name = "/aws/lambda/${aws_lambda_function.IngestConsumerLambda.function_name}"
  retention_in_days = "${var.LambdaLogRetention}"
}

resource "aws_iam_role" "IngestConsumerLambda_Role" {
  name = "${var.ResourcePrefix}IngestConsumerLambdaRole"
  path = "/service-role/"
  assume_role_policy = "${file("${path.module}/templates/LambdaExecutionRole.json")}"
}

resource "aws_iam_role_policy" "IngestConsumerLambda_Role_LoggingPolicy" {
  name = "LoggingPolicy"
  role = "${aws_iam_role.IngestConsumerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "${aws_cloudwatch_log_group.AppLogGroup.arn}",
        "${aws_cloudwatch_log_group.IngestConsumerLambda_LogGroup.arn}"
      ]
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestConsumerLambda_SQSPolicy" {
  name = "SQSPolicy"
  role = "${aws_iam_role.IngestConsumerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sqs:GetQueueAttributes",
      "Resource": "${aws_sqs_queue.ReceiveQueue.arn}"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestConsumerLambda_WorkerInvokePolicy" {
  name = "LambdaInvokePolicy"
  role = "${aws_iam_role.IngestConsumerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "${aws_lambda_function.IngestWorkerLambda.arn}"
    }
  ]
}

EOF
}

# ========================================
# Ingest Worker Lambda
# ========================================

resource "aws_lambda_function" "IngestWorkerLambda" {
  function_name = "${data.template_file.IngestWorkerLambdaFunctionName.rendered}"
  description = "TODO"
  role = "${aws_iam_role.IngestWorkerLambda_Role.arn}"
  handler = "lib/index/aws.ingestWorkerHandler"
  filename = "${path.module}/lambda_worker_src.zip"
  source_code_hash = "${base64sha256(file("${path.module}/lambda_worker_src.zip"))}"
  memory_size = 128
  timeout = "${var.QueueWorkerTimeoutSeconds}"
  runtime = "nodejs4.3"

  environment {
    variables {
      CONFIG = "${data.template_file.LambdaConfigJSON.rendered}"
    }
  }
}

resource "aws_cloudwatch_log_group" "IngestWorkerLambda_LogGroup" {
  name = "/aws/lambda/${aws_lambda_function.IngestWorkerLambda.function_name}"
  retention_in_days = "${var.LambdaLogRetention}"
}

resource "aws_iam_role" "IngestWorkerLambda_Role" {
  name = "${var.ResourcePrefix}IngestWorkerLambdaRole"
  path = "/service-role/"
  assume_role_policy = "${file("${path.module}/templates/LambdaExecutionRole.json")}"
}

resource "aws_iam_role_policy" "IngestWorkerLambda_Role_LoggingPolicy" {
  name = "LoggingPolicy"
  role = "${aws_iam_role.IngestWorkerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "${aws_cloudwatch_log_group.AppLogGroup.arn}",
        "${aws_cloudwatch_log_group.IngestWorkerLambda_LogGroup.arn}"
      ]
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestWorkerLambda_DBPolicy" {
  name = "DBPolicy"
  role = "${aws_iam_role.IngestWorkerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dynamodb:GetItem",
      "Resource": "${aws_dynamodb_table.Client.arn}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem"
      ],
      "Resource": "${aws_dynamodb_table.Backup.arn}"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestWorkerLambda_SQSPolicy" {
  name = "SQSPolicy"
  role = "${aws_iam_role.IngestWorkerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:DeleteMessage",
        "sqs:ReceiveMessage"
      ],
      "Resource": "${aws_sqs_queue.ReceiveQueue.arn}"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestWorkerLambda_ReceivingStoragePolicy" {
  name = "ReceivingS3Policy"
  role = "${aws_iam_role.IngestWorkerLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutObjectTagging"
      ],
      "Resource": [
        "${aws_s3_bucket.ReceivingStorageBucket.arn}/email/*",
        "${aws_s3_bucket.ReceivingStorageBucket.arn}/httppost/*"
      ]
    }
  ]
}
EOF
}

# ========================================
# Ingest Metric Stream Lambda
# ========================================

resource "aws_lambda_function" "IngestMetricStreamLambda" {
  function_name = "${var.ResourcePrefix}IngestMetricStreamLambda"
  description = "TODO"
  role = "${aws_iam_role.IngestMetricStreamLambda_Role.arn}"
  handler = "lib/index/aws.ingestMetricsStreamHandler"
  filename = "${path.module}/lambda_src.zip"
  source_code_hash = "${base64sha256(file("${path.module}/lambda_src.zip"))}"
  memory_size = 128
  timeout = "${var.QueueMetricStreamTimeoutSeconds}"
  runtime = "nodejs4.3"

  environment {
    variables {
      CONFIG = "${data.template_file.LambdaConfigJSON.rendered}"
    }
  }
}

resource "aws_cloudwatch_log_group" "IngestMetricStreamLambda_LogGroup" {
  name = "/aws/lambda/${aws_lambda_function.IngestMetricStreamLambda.function_name}"
  retention_in_days = "${var.LambdaLogRetention}"
}

resource "aws_iam_role" "IngestMetricStreamLambda_Role" {
  name = "${var.ResourcePrefix}IngestMetricStreamLambdaRole"
  path = "/service-role/"
  assume_role_policy = "${file("${path.module}/templates/LambdaExecutionRole.json")}"
}

resource "aws_iam_role_policy" "IngestMetricStreamLambda_Role_LoggingPolicy" {
  name = "LoggingPolicy"
  role = "${aws_iam_role.IngestMetricStreamLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "${aws_cloudwatch_log_group.AppLogGroup.arn}",
        "${aws_cloudwatch_log_group.IngestMetricStreamLambda_LogGroup.arn}"
      ]
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestMetricStreamLambda_DBPolicy" {
  name = "DBPolicy"
  role = "${aws_iam_role.IngestMetricStreamLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dynamodb:UpdateItem",
      "Resource": [
        "${aws_dynamodb_table.Client.arn}",
        "${aws_dynamodb_table.ClientMetric.arn}"
      ]
    }
  ]
}
EOF
}

resource "aws_iam_role_policy" "IngestMetricStreamLambda_DBStreamPolicy" {
  name = "DBStreamPolicy"
  role = "${aws_iam_role.IngestMetricStreamLambda_Role.id}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
        "Effect": "Allow",
        "Action": "lambda:InvokeFunction",
        "Resource": "${aws_lambda_function.IngestMetricStreamLambda.arn}*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetRecords",
        "dynamodb:GetShardIterator",
        "dynamodb:DescribeStream",
        "dynamodb:ListStreams"
      ],
      "Resource": "${aws_dynamodb_table.Backup.stream_arn}"
    }
  ]
}
EOF
}

resource "aws_lambda_event_source_mapping" "IngestMetricStreamLambda_DBStreamSource" {
  depends_on = ["aws_iam_role_policy.IngestMetricStreamLambda_DBStreamPolicy"]
  enabled = true
  event_source_arn = "${aws_dynamodb_table.Backup.stream_arn}"
  function_name = "${aws_lambda_function.IngestMetricStreamLambda.function_name}"
  batch_size = 100
  starting_position = "TRIM_HORIZON"
}

# ========================================
# Ingest Cron Event
# ========================================

resource "aws_cloudwatch_event_rule" "IngestCronEvent" {
  name = "${var.ResourcePrefix}IngestCronEvent"
  description = "TODO"
  schedule_expression = "rate(${var.QueueConsumerIntervalMinutes} ${var.QueueConsumerIntervalMinutes > 1 ? "minutes" : "minute"})"
  is_enabled = true
}

resource "aws_cloudwatch_event_target" "IngestCronEvent_Target" {
  target_id = "${var.ResourcePrefix}IngestCronEventTarget"
  rule = "${aws_cloudwatch_event_rule.IngestCronEvent.name}"
  arn = "${aws_lambda_function.IngestConsumerLambda.arn}"
  input = "{}"
}

resource "aws_lambda_permission" "IngestConsumerLambda_EventPermission" {
  statement_id = "AllowInvokeFromCloudWatchEvents"
  action = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.IngestConsumerLambda.arn}"
  principal = "events.amazonaws.com"
  source_arn = "${aws_cloudwatch_event_rule.IngestCronEvent.arn}"
}
