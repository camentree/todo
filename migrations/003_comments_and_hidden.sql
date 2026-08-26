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
        'skipped',
        'hidden'
    )
);

create table todo.comments (
    id bigint generated always as identity primary key,
    task_id bigint not null references todo.tasks (id) on delete cascade,
    author text not null default 'camen',
    body text not null,
    created_at timestamptz not null default now()
);

create index comments_task_idx on todo.comments (task_id, created_at);
