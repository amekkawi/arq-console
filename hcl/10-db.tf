resource "aws_dynamodb_table" "Client" {
  name = "${var.ResourcePrefix}ClientTable"
  read_capacity = 1
  write_capacity = 1
  hash_key = "clientId"

  attribute {
    name = "clientId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "Backup" {
  name = "${var.ResourcePrefix}BackupTable"
  read_capacity = 1
  write_capacity = 1
  hash_key = "clientId"
  range_key = "backupId"
  stream_enabled = true
  stream_view_type = "NEW_IMAGE"

  attribute {
    name = "clientId"
    type = "S"
  }

  attribute {
    name = "backupId"
    type = "S"
  }

  attribute {
    name = "backupDate"
    type = "S"
  }

  local_secondary_index {
    name = "LSI-backupDate"
    range_key = "backupDate"
    projection_type = "INCLUDE"
    non_key_attributes = [
      "duration",
      "errorCount",
      "totalBytes",
      "totalItems"
    ]
  }
}

resource "aws_dynamodb_table" "ClientMetric" {
  name = "${var.ResourcePrefix}ClientMetricTable"
  read_capacity = 1
  write_capacity = 1
  hash_key = "clientId"
  range_key = "metricId"

  attribute {
    name = "clientId"
    type = "S"
  }

  attribute {
    name = "metricId"
    type = "S"
  }
}
