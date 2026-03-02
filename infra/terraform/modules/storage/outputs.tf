output "s3_bucket_name" {
  value = aws_s3_bucket.dicom.bucket
}

output "s3_bucket_arn" {
  value = aws_s3_bucket.dicom.arn
}