import { ChevronDown } from 'lucide-react';
import { useRef, useState, type RefObject } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChangeMemberRole, useRemoveMember } from '@/features/members/api/useMembers';
import {
  actionLabel,
  availableActions,
  confirmCopy,
  needsConfirmation,
  successMessage,
  type MemberAction,
} from '@/features/members/memberActions';
import { memberName } from '@/features/members/names';
import type { OrgMember } from '@/features/members/types';
import { toAppError } from '@/lib/errors';

interface MemberActionsProps {
  orgId: string;
  orgName: string;
  member: OrgMember;
  isYou: boolean;
  /** Announces a completed change. */
  onDone: (message: string) => void;
  /** Where focus goes after a removal, since the removed row takes its Manage button with it. */
  afterRemoveFocusRef: RefObject<HTMLElement | null>;
}

/** An owner's menu for one member: change role or remove, confirming risky changes. */
export function MemberActions({
  orgId,
  orgName,
  member,
  isYou,
  onDone,
  afterRemoveFocusRef,
}: MemberActionsProps) {
  const changeRole = useChangeMemberRole(orgId);
  const remove = useRemoveMember(orgId);
  const [confirming, setConfirming] = useState<MemberAction | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pending = changeRole.isPending || remove.isPending;
  const failure = changeRole.error ?? remove.error;

  const run = (action: MemberAction) => {
    const options = {
      onSuccess: () => {
        setConfirming(null);
        onDone(successMessage(member, action, isYou));
      },
    };
    if (action.kind === 'remove') remove.mutate({ orgId, userId: member.userId }, options);
    else changeRole.mutate({ orgId, userId: member.userId, role: action.role }, options);
  };

  const choose = (action: MemberAction) => {
    changeRole.reset();
    remove.reset();
    if (needsConfirmation(member, action)) setConfirming(action);
    else run(action);
  };

  const actions = availableActions(member, isYou);
  const roleActions = actions.filter((action) => action.kind === 'role');
  const canRemove = actions.some((action) => action.kind === 'remove');

  return (
    <>
      {/* Non-modal, so the menu fully closes before a confirmation dialog takes focus. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={pending && !confirming}
            aria-label={isYou ? 'Manage your role' : `Manage ${memberName(member)}`}
          >
            Manage
            <ChevronDown aria-hidden="true" data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {roleActions.map((action) => (
            <DropdownMenuItem
              key={actionLabel(action)}
              onSelect={() => {
                choose(action);
              }}
            >
              {actionLabel(action)}
            </DropdownMenuItem>
          ))}
          {canRemove && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  choose({ kind: 'remove' });
                }}
              >
                Remove from organization
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Changes that apply immediately report failures here; confirmed ones inside the dialog. */}
      {failure && !confirming && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {toAppError(failure).message}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          {...confirmCopy(member, confirming, isYou, orgName)}
          pendingLabel="Saving…"
          pending={pending}
          error={failure ? toAppError(failure).message : null}
          onConfirm={() => {
            run(confirming);
          }}
          returnFocusRef={confirming.kind === 'remove' ? afterRemoveFocusRef : triggerRef}
        />
      )}
    </>
  );
}
