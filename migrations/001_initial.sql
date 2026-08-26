create schema if not exists todo;

create table todo.lists (
    id bigint generated always as identity primary key,
    name text not null unique,
    sort_order integer not null default 0,
    has_workflow boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table todo.recurring_tasks (
    id bigint generated always as identity primary key,
    list_id bigint not null references todo.lists (id) on delete cascade,
    title text not null,
    note text,
    tags text [] not null default '{}',
    who text,
    subtask_titles text [] not null default '{}',
    frequency text not null,
    repeat_every integer not null default 1,
    weekdays smallint [] not null default '{}',
    day_of_month smallint,
    due_time time,
    starts_on date not null,
    paused boolean not null default false,
    generated_through date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint recurring_tasks_frequency_known check (
        frequency in ('daily', 'weekly', 'monthly')
    ),
    constraint recurring_tasks_repeat_every_positive check (repeat_every > 0)
);

create table todo.tasks (
    id bigint generated always as identity primary key,
    list_id bigint not null references todo.lists (id) on delete cascade,
    parent_id bigint references todo.tasks (id) on delete cascade,
    recurring_task_id bigint references todo.recurring_tasks (
        id
    ) on delete set null,
    title text not null,
    note text,
    state text not null default 'to_do',
    tags text [] not null default '{}',
    who text,
    due_date date,
    due_time time,
    sort_order integer not null default 0,
    completed_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tasks_state_known check (
        state in (
            'to_do',
            'in_progress',
            'in_review',
            'needs_input',
            'blocked',
            'complete',
            'missed'
        )
    )
);

create index tasks_list_idx on todo.tasks (list_id) where archived_at is null;
create index tasks_due_date_idx on todo.tasks (due_date) where
archived_at is null;
create index tasks_parent_idx on todo.tasks (parent_id);
create index tasks_recurring_idx on todo.tasks (recurring_task_id, due_date);

create table todo.events (
    id bigint generated always as identity primary key,
    task_id bigint references todo.tasks (id) on delete cascade,
    source text not null,
    summary text not null,
    created_at timestamptz not null default now(),
    constraint events_source_known check (
        source in ('app', 'system', 'mcp', 'agent')
    )
);

create index events_created_at_idx on todo.events (created_at desc);

create table todo.settings (
    id integer primary key default 1,
    default_list_id bigint references todo.lists (id) on delete set null,
    notifications_seen_at timestamptz not null default now(),
    constraint settings_single_row check (id = 1)
);

insert into todo.settings (id) values (1);

insert into todo.lists (name, sort_order, has_workflow) values
('Personal', 0, false),
('Programming', 1, true);

update todo.settings
set default_list_id = (select id from todo.lists where name = 'Personal');
