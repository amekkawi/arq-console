resource "aws_s3_bucket" "ReceivingStorageBucket" {
  bucket = "${var.ResourcePrefix}${data.aws_caller_identity.Current.account_id}DeliveryBucket"
  acl = "private"

  lifecycle_rule {
    id = "${var.ResourcePrefix}EmailContentLifecycle"
    enabled = true
    prefix = "email/"
    abort_incomplete_multipart_upload_days = 1

    transition {
      days = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }

  lifecycle_rule {
    id = "${var.ResourcePrefix}HttpPostContentLifecycle"
    enabled = true
    prefix = "httppost/"
    abort_incomplete_multipart_upload_days = 1

    transition {
      days = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_policy" "ReceivingStorageBucketPolicy" {
  bucket = "${aws_s3_bucket.ReceivingStorageBucket.bucket}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ses.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "${aws_s3_bucket.ReceivingStorageBucket.arn}/*",
      "Condition": {
        "StringEquals": {
          "aws:Referer": "${data.aws_caller_identity.Current.account_id}"
        }
      }
    }
  ]
}
EOF
}
