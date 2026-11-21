-- Lock the gym tables to the single owner account, on top of the
-- own-rows + MFA policies from 0001. Even if another account somehow
-- existed, it could not read or write a single gym row.
-- The dashboard assistant keeps working: it either signs in as the owner
-- or uses the service role, which RLS does not apply to.
do $$
declare t text;
begin
  foreach t in array array['gym_programs', 'gym_sessions', 'gym_body_stats'] loop
    execute format('drop policy if exists %1$s_only_owner on public.%1$s', t);
    execute format($p$create policy %1$s_only_owner on public.%1$s as restrictive for all to authenticated
      using ((select auth.uid()) = 'ed0d8a51-5211-4efc-9250-fd20b667e435'::uuid)
      with check ((select auth.uid()) = 'ed0d8a51-5211-4efc-9250-fd20b667e435'::uuid)$p$, t);
  end loop;
end $$;

-- gym_push should only be callable by signed-in users.
revoke execute on function public.gym_push(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.gym_push(jsonb, jsonb, jsonb) to authenticated;
