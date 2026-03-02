resource "aws_s3_bucket" "dicom" {
  bucket = var.s3_bucket_name

  tags = {
    Name = "${var.name_prefix}-dicom"
  }
}

resource "aws_s3_bucket_versioning" "dicom" {
  bucket = aws_s3_bucket.dicom.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "dicom" {
  bucket = aws_s3_bucket.dicom.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "dicom" {
  bucket = aws_s3_bucket.dicom.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}