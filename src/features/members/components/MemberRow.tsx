import type { ReactNode } from 'react';
import { RoleBadge } from '@/components/common/RoleBadge';
import { memberName } from '@/features/members/names';
import type { OrgMember } from '@/features/members/types';
import { formatDate } from '@/lib/dates';

interface MemberRowProps {
  member: OrgMember;
  isYou: boolean;
  timeZone: string;
  /** The owner's Manage menu, when the viewer can manage members. */
  actions?: ReactNode;
}

export function MemberRow({ member, isYou, timeZone, actions }: MemberRowProps) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium">
          {memberName(member)}
          {isYou && <span className="font-normal text-muted-foreground"> (you)</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{member.email}</p>
      </div>
      <RoleBadge role={member.role} />
      <p className="text-sm text-muted-foreground">
        Joined {formatDate(member.joinedAt, timeZone)}
      </p>
      {actions}
    </li>
  );
}
