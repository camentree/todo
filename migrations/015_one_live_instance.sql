update todo.tasks as stale
set state = 'missed',
    finished_at = coalesce(finished_at, now()),
    updated_at = now()
where stale.recurring_task_id is not null
  and stale.parent_id is null
  and stale.state not in ('complete', 'missed', 'skipped', 'archived')
  and exists (
    select 1
    from todo.tasks as newer
    where newer.recurring_task_id = stale.recurring_task_id
      and newer.parent_id is null
      and newer.state not in
        ('complete', 'missed', 'skipped', 'archived')
      and (newer.due_date, newer.id) > (stale.due_date, stale.id)
  );

create unique index tasks_one_live_instance_idx
on todo.tasks (recurring_task_id)
where recurring_task_id is not null
  and parent_id is null
  and state not in ('complete', 'missed', 'skipped', 'archived');
