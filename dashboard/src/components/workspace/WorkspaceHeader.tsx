import { useDialog } from '@/components/common/DialogProvider';
import { EditWorkspaceNameForm } from '@/components/home/EditWorkspaceNameForm';
import RemoveWorkspaceModal from '@/components/workspace/RemoveWorkspaceModal';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import { Avatar } from '@/ui/Avatar';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import Text from '@/ui/v2/Text';
import { copy } from '@/utils/copy';
import { nhost } from '@/utils/nhost';
import Image from 'next/image';

export default function WorkspaceHeader() {
  const { currentWorkspace } = useCurrentWorkspaceAndProject();

  const { openDialog } = useDialog();

  const user = nhost.auth.getUser();

  const isOwner = currentWorkspace?.workspaceMembers.some(
    (member) => member.user.id === user?.id && member.type === 'owner',
  );

  const noApplications = currentWorkspace?.projects.length === 0;

  const IS_DEFAULT_WORKSPACE = currentWorkspace?.name === 'Default Workspace';

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="flex flex-row place-content-between">
        <div className="flex flex-row items-center">
          {IS_DEFAULT_WORKSPACE &&
          user.id === currentWorkspace?.creatorUserId ? (
            <Avatar
              className="h-14 w-14 self-center rounded-full"
              name={user?.displayName}
              avatarUrl={user?.avatarUrl}
            />
          ) : (
            <div className="inline-block h-14 w-14 overflow-hidden rounded-xl">
              <Image
                src="/logos/new.svg"
                alt="Nhost Logo"
                width={56}
                height={56}
              />
            </div>
          )}

          <div className="flex flex-col items-start pl-3">
            <Text variant="h1" className="font-display text-3xl font-medium">
              {currentWorkspace?.name}
            </Text>
            <Button
              variant="borderless"
              color="secondary"
              className="py-1 pl-1 font-display text-xs font-medium"
              onClick={() =>
                copy(
                  `https://app.nhost.io/${currentWorkspace.slug}`,
                  'Workspace URL',
                )
              }
            >
              <Text
                component="span"
                className="text-xs font-medium"
                color="secondary"
              >
                app.nhost.io/
              </Text>
              {currentWorkspace?.slug}
            </Button>
          </div>
        </div>

        <div className="hidden self-center sm:block">
          {currentWorkspace && isOwner && (
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button variant="outlined" color="secondary" className="gap-2">
                  Workspace Options
                </Button>
              </Dropdown.Trigger>

              <Dropdown.Content
                PaperProps={{ className: 'mt-1 max-w-[280px]' }}
                menu
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              >
                <Dropdown.Item
                  className="py-2"
                  onClick={() => {
                    openDialog({
                      title: (
                        <span className="grid grid-flow-row">
                          <span>Change Workspace Name</span>
                          <Text variant="subtitle1" component="span">
                            Changing the workspace name will also affect the URL
                            of the workspace.
                          </Text>
                        </span>
                      ),
                      component: (
                        <EditWorkspaceNameForm
                          currentWorkspaceId={currentWorkspace.id}
                          currentWorkspaceName={currentWorkspace.name}
                        />
                      ),
                    });
                  }}
                >
                  Change Workspace Name
                </Dropdown.Item>

                <Divider component="li" sx={{ margin: 0 }} />

                <Dropdown.Item
                  className="grid grid-flow-row whitespace-pre-wrap py-2 font-medium"
                  disabled={!noApplications}
                  onClick={() =>
                    openDialog({
                      title: (
                        <span className="grid grid-flow-row">
                          <span>Delete Workspace</span>

                          <Text variant="subtitle1" component="span">
                            There is no way to recover this workspace later.
                          </Text>
                        </span>
                      ),
                      component: <RemoveWorkspaceModal />,
                      props: {
                        titleProps: { className: '!pb-0' },
                      },
                    })
                  }
                  sx={{ color: 'error.main' }}
                >
                  Delete Workspace
                  {!noApplications && (
                    <Text
                      variant="caption"
                      className="font-medium"
                      color="disabled"
                    >
                      You can&apos;t delete this workspace because you have
                      projects running. Delete all projects first.
                    </Text>
                  )}
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          )}
        </div>
      </div>
    </div>
  );
}
