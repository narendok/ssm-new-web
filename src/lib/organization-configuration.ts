import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { getOrganizationConfiguration } from './organization-configuration.functions';

export { DEPARTMENT_MODULES } from './department-modules';
export function useOrganizationConfiguration(scopeKey?:string) {
  const load=useServerFn(getOrganizationConfiguration);
  const cache=useQueryClient();
  const query=useQuery({queryKey:['organization-configuration',scopeKey],queryFn:()=>load(),enabled:!!scopeKey,retry:false,refetchOnWindowFocus:true,refetchInterval:30000});
  useEffect(()=>{
    if(!scopeKey)return;
    const channel=supabase.channel(`organization-configuration:${scopeKey}`).on('postgres_changes',{event:'*',schema:'public',table:'departments'},()=>{
      void cache.invalidateQueries({queryKey:['organization-configuration']});
      void cache.invalidateQueries({queryKey:['shared-test-workspace']});
      void cache.invalidateQueries({queryKey:['shared-operational-workspace']});
      void cache.invalidateQueries({queryKey:['project-coordination']});
      void cache.invalidateQueries({queryKey:['lifecycle-workspace']});
    }).subscribe();
    return ()=>{void supabase.removeChannel(channel);};
  },[scopeKey,cache]);
  return query;
}
