alter table todo.tasks drop constraint tasks_state_known;

alter table todo.tasks add constraint tasks_state_known check (
    state in (
        'to_do',
        'in_progress',
        'in_review',
        'needs_input',
        'blocked',
        'complete',
        'missed',
        'skipped'
    )
);

alter table todo.tasks rename column completed_at to resolved_at;
