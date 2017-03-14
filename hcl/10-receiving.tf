# =================================
# E-mail delivery
# =================================

# Verify e-mail function
# ---------------------------------

resource "aws_cloudwatch_log_group" "VerifyEmailLambda_LogGroup" {
  name = "/aws/lambda/${aws_lambda_function.VerifyEmailLambda.function_name}"
  retention_in_days = "${var.LambdaLogRetention}"
}

resource "aws_lambda_function" "VerifyEmailLambda" {
  function_name = "${var.ResourcePrefix}VerifyEmailLambda"
  description = "TODO"
  role = "${aws_iam_role.VerifyEmailLambda_Role.arn}"
  handler = "lib/index/aws.receivingVerifyEmailRecipients"
  filename = "${path.module}/lambda_src.zip"
  source_code_hash = "${base64sha256(file("${path.module}/lambda_src.zip"))}"
  memory_size = 128
  timeout = "${var.ReceivingVerifyEmailTimeoutSeconds}"
  runtime = "nodejs4.3"

  environment {
    variables {
      CONFIG = "${data.template_file.LambdaConfigJSON.rendered}"
    }
  }
}

resource "aws_iam_role" "VerifyEmailLambda_Role" {
  name = "${var.ResourcePrefix}VerifyEmailLambdaRole"
  path = "/service-role/"
  assume_role_policy = "${file("${path.module}/templates/LambdaExecutionRole.json")}"
}

resource "aws_iam_role_policy" "VerifyEmailLambda_Role_LoggingPolicy" {
  name = "LambdaLoggingPolicy"
  role = "${aws_iam_role.VerifyEmailLambda_Role.name}"
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
        "${aws_cloudwatch_log_group.VerifyEmailLambda_LogGroup.arn}"
      ]
    }
  ]
}
EOF
}

resource "aws_lambda_permission" "VerifyEmailLambda_SESPermission" {
  statement_id = "AllowInvokeFromSES"
  action = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.VerifyEmailLambda.arn}"
  principal = "ses.amazonaws.com"
  source_account = "${data.aws_caller_identity.Current.account_id}"
}

resource "aws_iam_role_policy" "VerifyEmailLambda_DBPolicy" {
  name = "DBPolicy"
  role = "${aws_iam_role.VerifyEmailLambda_Role.name}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem"
      ],
      "Resource": [
        "${aws_dynamodb_table.Client.arn}"
      ]
    }
  ]
}
EOF
}

# SES
# ---------------------------------

# Add a header to the email and store it in S3
resource "aws_ses_receipt_rule" "SESReceiveRule" {
  depends_on = ["aws_s3_bucket.ReceivingStorageBucket"]

  name = "${var.ResourcePrefix}SESRule"
  rule_set_name = "${var.SesRuleSet}"
  recipients = [
    "${var.EmailPrefix}@${var.EmailDomain}"
  ]
  # TODO: Allow secondary e-mail
  enabled = true
  scan_enabled = false
  tls_policy = "Require"

  lambda_action {
    function_arn = "${aws_lambda_function.VerifyEmailLambda.arn}"
    invocation_type = "RequestResponse"
    position = 0
  }

  s3_action {
    bucket_name = "${aws_s3_bucket.ReceivingStorageBucket.bucket}"
    object_key_prefix = "email"
    topic_arn = "${aws_sns_topic.EmailReceiveTopic.arn}"
    position = 1
  }
}

resource "aws_sns_topic" "EmailReceiveTopic" {
  name = "${var.ResourcePrefix}EmailReceivingTopic"
}

resource "aws_sns_topic_subscription" "EmailReceiveTopic_ToQueue" {
  topic_arn = "${aws_sns_topic.EmailReceiveTopic.arn}"
  protocol = "sqs"
  endpoint = "${aws_sqs_queue.ReceiveQueue.arn}"
}

resource "aws_sqs_queue_policy" "EmailReceiveTopic_ToQueuePolicy" {
  queue_url = "${aws_sqs_queue.ReceiveQueue.id}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "sqs:SendMessage",
      "Resource": "${aws_sqs_queue.ReceiveQueue.arn}",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "${aws_sns_topic.EmailReceiveTopic.arn}"
        }
      }
    }
  ]
}

EOF
}

resource "aws_iam_user_policy" "SESSendEmailPolicy" {
  user = "${aws_iam_user.SMTPUser.name}"
  name = "${var.ResourcePrefix}SESSendEmailPolicy"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ses:SendRawEmail",
      "Resource": "*",
      "Condition": {
        "ForAllValues:StringLike": {
          "ses:Recipients": [
            "${var.EmailPrefix}+*@${var.EmailPrefix}"
            ${var.SecondaryEmail == "" ? "" : format(", \"%s\"", var.SecondaryEmail)}
          ]
        }
      }
    }
  ]
}
EOF
}

resource "aws_iam_user" "SMTPUser" {
  name = "${var.ResourcePrefix}SESSendEmailUser"
  #force_destroy = true
}

# =================================
# HTTP POST Delivery
# =================================

resource "aws_cloudwatch_log_group" "HTTPPostReceivingLambda_LogGroup" {
  name = "/aws/lambda/${aws_lambda_function.HTTPPostReceivingLambda.function_name}"
  retention_in_days = "${var.LambdaLogRetention}"
}

resource "aws_lambda_function" "HTTPPostReceivingLambda" {
  function_name = "${var.ResourcePrefix}HttpPostLambda"
  description = "TODO"
  role = "${aws_iam_role.HTTPPostReceivingLambda_Role.arn}"
  handler = "lib/index/aws.receivingHTTPPost"
  filename = "${path.module}/lambda_src.zip"
  source_code_hash = "${base64sha256(file("${path.module}/lambda_src.zip"))}"
  memory_size = 128
  timeout = "${var.ReceivingHTTPPostTimeoutSeconds}"
  runtime = "nodejs4.3"

  environment {
    variables {
      CONFIG = "${data.template_file.LambdaConfigJSON.rendered}"
    }
  }
}

resource "aws_iam_role" "HTTPPostReceivingLambda_Role" {
  name = "${var.ResourcePrefix}HttpPostLambdaRole"
  path = "/service-role/"
  assume_role_policy = "${file("${path.module}/templates/LambdaExecutionRole.json")}"
}

resource "aws_iam_role_policy" "HTTPPostReceivingLambda_Role_LoggingPolicy" {
  name = "LoggingPolicy"
  role = "${aws_iam_role.HTTPPostReceivingLambda_Role.name}"
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
        "${aws_cloudwatch_log_group.HTTPPostReceivingLambda_LogGroup.arn}"
      ]
    }
  ]
}
EOF
}

resource "aws_lambda_permission" "HTTPPostReceivingLambda_APIGatewayPermission" {
  statement_id = "AllowInvokeFromAPIGateway"
  action = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.HTTPPostReceivingLambda.arn}"
  principal = "apigateway.amazonaws.com"
  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${data.aws_region.Current.id}:${data.aws_caller_identity.Current.account_id}:${aws_api_gateway_rest_api.API.id}/*/${aws_api_gateway_method.APIReceivingProxyPOST.http_method}${aws_api_gateway_resource.APIReceiving.path}/*"
}
