variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "aws_account_id" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_security_group_id" {
  type = string
}

variable "s3_bucket_arn" {
  type = string
}

variable "s3_bucket_name" {
  type = string
}

variable "db_host" {
  type = string
}

variable "db_port" {
  type = number
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "redis_endpoint" {
  type = string
}

variable "redis_port" {
  type = number
}

variable "ecs_cpu" {
  type = map(number)
}

variable "ecs_memory" {
  type = map(number)
}

variable "image_api" {
  type = string
}

variable "image_worker" {
  type = string
}

variable "image_web" {
  type = string
}

variable "image_orthanc" {
  type = string
}

variable "log_group_names" {
  type = object({
    api     = string
    worker  = string
    web     = string
    orthanc = string
  })
}

variable "resolve_ssm_parameters" {
  type = bool
}

variable "ssm_db_password_parameter_name" {
  type = string
}

variable "ssm_jwt_private_parameter_name" {
  type = string
}

variable "ssm_jwt_public_parameter_name" {
  type = string
}