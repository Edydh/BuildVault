# Supabase DB Health Runbook (BuildVault)

This runbook tracks table growth early and keeps project queries fast as data scales.

## What was added

- `public.db_health_snapshots`: stores point-in-time size and row estimates.
- `public.db_health_latest`: latest snapshot + growth delta vs prior snapshot.
- `public.db_health_weekly_growth`: weekly trend per table.
- `public.db_health_alerts`: severity + recommendation (`ok`, `warning`, `critical`).
- `public.activity_log_archive`: cold storage for old activity rows.
- `public.archive_old_activity_log(keep_days, batch_size)`: safe batch archive helper.
- `public.capture_db_health_snapshot()`: snapshot collector.

## Weekly operator workflow

1. Capture a snapshot:

```sql
select public.capture_db_health_snapshot();
```

2. Check alerts:

```sql
select *
from public.db_health_alerts
where severity <> 'ok'
order by severity desc, relation_name asc;
```

3. Review trends:

```sql
select *
from public.db_health_weekly_growth
where relation_name in ('media', 'activity_log')
order by week_start desc, relation_name asc
limit 24;
```

4. If `activity_log` is warning/critical, archive in batches:

```sql
select * from public.archive_old_activity_log(180, 10000);
```

Run that statement repeatedly until `remaining_count = 0`.

## Thresholds (current defaults)

- `activity_log`:
  - `warning`: `row_estimate >= 250,000`
  - `critical`: `row_estimate >= 1,000,000`
- `media`:
  - `warning`: `total_bytes >= 5 GB`
  - `critical`: `total_bytes >= 20 GB`
- Any table:
  - `warning`: dead-row ratio `>= 0.20`
  - `critical`: dead-row ratio `>= 0.40`

## BuildVault guidance

- Keep raw images/videos/docs in Supabase Storage buckets.
- Keep only metadata + storage path in `public.media`.
- Keep `activity_log` hot window to 180 days in primary table.
- Use archive table for older timeline records (audit-safe, query-light).
