# The single table. PK = USER#<sub> holds a user's profile, workouts (WO#), days (DAY#), benchmarks
# (BM#, BMR#), friends (FRIEND#), club list (CLUB#) and leaderboard rows (LBPB#, LBCON). Other keys:
# CLUB#<id> (META, MEMBER#), CODE#<code>, CAL#<token>, and RL#<key> rate-limit counters.
# See apps/web/lib/db/repo.ts.
#
# Only the keys and the index keys are declared: every other attribute is schemaless.
resource "aws_dynamodb_table" "main" {
  name         = var.name_prefix
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "lbKey"
    type = "S"
  }

  attribute {
    name = "lbScore"
    type = "N"
  }

  # Leaderboards: one PB row per opted-in user per built-in benchmark, queried by benchmark
  # (lbKey = "LB#<catalogKey>") and sorted by score.
  global_secondary_index {
    name            = "leaderboard"
    hash_key        = "lbKey"
    range_key       = "lbScore"
    projection_type = "ALL"
  }

  # Rate-limit counters (RL#…) carry an expiry so DynamoDB deletes them on its own.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  # Everyone's training history. Both guards stop a bad change or a mistyped destroy from taking it.
  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}
