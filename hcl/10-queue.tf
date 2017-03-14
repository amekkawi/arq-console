resource "aws_sqs_queue" "ReceiveQueue" {
  name = "${var.ResourcePrefix}ReceivingQueue"
  visibility_timeout_seconds = 120
  message_retention_seconds = 1209600 # TODO
  #max_message_size = 262144
  #delay_seconds = 0
  #receive_wait_time_seconds = 0
  #policy = ""
  #redrive_policy = "{\"deadLetterTargetArn\":\"${aws_sqs_queue.terraform_queue_deadletter.arn}\",\"maxReceiveCount\":4}"
}
