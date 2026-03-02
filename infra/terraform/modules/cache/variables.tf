variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "elasticache_sg_id" {
  type = string
}

variable "cache_node_type" {
  type = string
}

variable "redis_port" {
  type = number
}