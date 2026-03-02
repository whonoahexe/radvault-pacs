terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 6.31.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region                      = var.aws_region
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true

  default_tags {
    tags = {
      Project     = "radvault-pacs"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name_prefix = "radvault-${var.environment}"

  log_group_names = {
    api    = "/ecs/${local.name_prefix}/api"
    worker = "/ecs/${local.name_prefix}/worker"
    web    = "/ecs/${local.name_prefix}/web"
    orthanc = "/ecs/${local.name_prefix}/orthanc"
  }
}

module "networking" {
  source = "./modules/networking"

  name_prefix = local.name_prefix
}

module "storage" {
  source = "./modules/storage"

  name_prefix     = local.name_prefix
  s3_bucket_name  = var.s3_bucket_name
}

module "database" {
  source = "./modules/database"

  name_prefix        = local.name_prefix
  db_name            = var.db_name
  db_username        = var.db_username
  db_instance_class  = var.db_instance_class
  db_multi_az_enabled = var.db_multi_az_enabled
  private_subnet_ids = module.networking.private_subnet_ids
  rds_security_group_id = module.networking.rds_security_group_id
}

module "cache" {
  source = "./modules/cache"

  name_prefix             = local.name_prefix
  environment             = var.environment
  private_subnet_ids      = module.networking.private_subnet_ids
  elasticache_sg_id       = module.networking.elasticache_security_group_id
  cache_node_type         = var.cache_node_type
  redis_port              = var.redis_port
}

module "monitoring" {
  source = "./modules/monitoring"

  name_prefix      = local.name_prefix
  log_group_names  = local.log_group_names
  alarm_email      = var.alarm_email
  ecs_cluster_name = "${local.name_prefix}-cluster"
  api_service_name = "${local.name_prefix}-api"
}

module "compute" {
  source = "./modules/compute"

  name_prefix         = local.name_prefix
  aws_region          = var.aws_region
  aws_account_id      = var.aws_account_id
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  private_subnet_ids  = module.networking.private_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  ecs_security_group_id = module.networking.ecs_security_group_id
  s3_bucket_arn       = module.storage.s3_bucket_arn
  s3_bucket_name      = module.storage.s3_bucket_name

  db_host             = module.database.db_endpoint
  db_port             = module.database.db_port
  db_name             = module.database.db_name
  db_username         = module.database.db_username
  redis_endpoint      = module.cache.redis_primary_endpoint
  redis_port          = module.cache.redis_port

  ecs_cpu             = var.ecs_cpu
  ecs_memory          = var.ecs_memory
  image_api           = var.image_api
  image_worker        = var.image_worker
  image_web           = var.image_web
  image_orthanc       = var.image_orthanc

  log_group_names = local.log_group_names

  resolve_ssm_parameters           = var.resolve_ssm_parameters
  ssm_db_password_parameter_name   = var.ssm_db_password_parameter_name
  ssm_jwt_private_parameter_name   = var.ssm_jwt_private_parameter_name
  ssm_jwt_public_parameter_name    = var.ssm_jwt_public_parameter_name

  depends_on = [module.monitoring]
}