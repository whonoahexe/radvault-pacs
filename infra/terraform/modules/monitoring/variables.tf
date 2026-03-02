variable "name_prefix" {
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

variable "alarm_email" {
  type = string
}

variable "ecs_cluster_name" {
  type = string
}

variable "api_service_name" {
  type = string
}