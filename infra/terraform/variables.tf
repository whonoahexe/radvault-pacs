variable "environment" {
  description = "Deployment environment"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID used for deterministic ARN construction in validation-only plans"
  type        = string
  default     = "123456789012"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_multi_az_enabled" {
  description = "Whether Multi-AZ is enabled for RDS"
  type        = bool
  default     = false
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "radvault"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "radvault"
}

variable "ecs_cpu" {
  description = "CPU units per ECS service"
  type        = map(number)
  default = {
    api    = 512
    worker = 512
    web    = 512
    orthanc = 512
  }
}

variable "ecs_memory" {
  description = "Memory (MiB) per ECS service"
  type        = map(number)
  default = {
    api    = 1024
    worker = 1024
    web    = 1024
    orthanc = 1024
  }
}

variable "s3_bucket_name" {
  description = "S3 bucket name for DICOM and thumbnails"
  type        = string
}

variable "cache_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "alarm_email" {
  description = "Email for SNS alarm subscriptions"
  type        = string
}

variable "image_api" {
  description = "Container image URI for api"
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-alpine"
}

variable "image_worker" {
  description = "Container image URI for worker"
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-alpine"
}

variable "image_web" {
  description = "Container image URI for web"
  type        = string
  default     = "public.ecr.aws/docker/library/node:20-alpine"
}

variable "image_orthanc" {
  description = "Container image URI for orthanc"
  type        = string
  default     = "jodogne/orthanc-plugins:latest"
}

variable "resolve_ssm_parameters" {
  description = "Whether to resolve SSM parameter values at plan/apply time"
  type        = bool
  default     = false
}

variable "ssm_db_password_parameter_name" {
  description = "SSM parameter name for database password"
  type        = string
}

variable "ssm_jwt_private_parameter_name" {
  description = "SSM parameter name for JWT private key"
  type        = string
}

variable "ssm_jwt_public_parameter_name" {
  description = "SSM parameter name for JWT public key"
  type        = string
}