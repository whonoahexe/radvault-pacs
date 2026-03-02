output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = module.compute.alb_dns_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.compute.cluster_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.database.db_endpoint
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = module.cache.redis_primary_endpoint
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.storage.s3_bucket_name
}