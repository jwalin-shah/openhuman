## 2024-05-18 - Parameterized Queries for Limit/Offset
**Vulnerability:** String formatting was used to append `LIMIT` and `OFFSET` into SQL strings instead of parameterized binding.
**Learning:** Using `format!("LIMIT {limit}")` runs the risk of SQL injection if variables are refactored to allow strings. Even when variables are strongly typed as numeric (`usize`), it violates best practices to use string concatenation, which can also trigger security linters.
**Prevention:** Always use parameterized placeholders (`?`) for variables in SQL queries, including `LIMIT` and `OFFSET`. Construct a vector of `rusqlite::types::Value` and pass to `.query(rusqlite::params_from_iter(query_params))` when building dynamic SQL queries.
