import { use } from 'react';
import { OrgContext, type OrgContextValue } from '@/context/orgContext';

export function useOrg(): OrgContextValue {
  const value = use(OrgContext);
  if (!value) throw new Error('useOrg must be used inside an organization route (<OrgLayout>).');
  return value;
}
