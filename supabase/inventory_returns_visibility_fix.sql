-- 可选修复：让退货记录对创建者与组织成员可见。
-- 背景：inventory_create_sale_return RPC 是早期 user_id 模型（security definer 直写），
-- 创建的 inventory_returns / inventory_return_items 行没有 organization_id，
-- 而组织化的 SELECT 策略只按 organization_id 匹配，导致退货记录列表不可见。
-- 执行本脚本后：创建者本人可见（stock / 订单状态更新不受影响，本就生效）。
-- workTime 已有项目可随时执行；全新项目无需执行。

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_returns'
      and policyname = 'Returns visible to creator or organization members'
  ) then
    create policy "Returns visible to creator or organization members"
    on public.inventory_returns
    for select to authenticated
    using (
      user_id = auth.uid()
      or organization_id = public.inventory_current_organization_id()
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inventory_return_items'
      and policyname = 'Return items visible via returns'
  ) then
    create policy "Return items visible via returns"
    on public.inventory_return_items
    for select to authenticated
    using (
      exists (
        select 1 from public.inventory_returns r
        where r.id = return_id
          and (r.user_id = auth.uid() or r.organization_id = public.inventory_current_organization_id())
      )
    );
  end if;
end
$$;
