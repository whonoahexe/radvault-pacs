resource "random_password" "db" {
  length  = 24
  special = true
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_parameter_group" "this" {
  name   = "${var.name_prefix}-postgres15-params"
  family = "postgres15"
}

resource "aws_db_instance" "this" {
  identifier             = "${var.name_prefix}-postgres"
  allocated_storage      = 20
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = var.db_instance_class
  db_name                = var.db_name
  username               = var.db_username
  password               = random_password.db.result
  port                   = 5432
  multi_az               = var.db_multi_az_enabled
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.rds_security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name
  publicly_accessible    = false
  storage_encrypted      = true
  skip_final_snapshot    = true
}