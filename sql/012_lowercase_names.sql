update todo.tasks set list = lower(trim(list));
update todo.recurring_tasks set list = lower(trim(list));

update todo.tasks set who = lower(trim(who)) where who is not null;
update todo.recurring_tasks
set who = lower(trim(who))
where who is not null;

update todo.tasks
set tags = coalesce(
    (
        select array_agg(distinct lower(trim(tag)) order by lower(trim(tag)))
        from unnest(tags) as tag
    ),
    '{}'
);

update todo.recurring_tasks
set tags = coalesce(
    (
        select array_agg(distinct lower(trim(tag)) order by lower(trim(tag)))
        from unnest(tags) as tag
    ),
    '{}'
);

alter table todo.tasks add constraint tasks_list_canonical check (
    list = lower(trim(list))
);

alter table todo.tasks add constraint tasks_who_canonical check (
    who is null or who = lower(trim(who))
);

alter table todo.recurring_tasks
add constraint recurring_list_canonical check (
    list = lower(trim(list))
);

alter table todo.recurring_tasks
add constraint recurring_who_canonical check (
    who is null or who = lower(trim(who))
);
