import Form from '@/components/common/Form';
import InlineCode from '@/components/common/InlineCode';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import {
  GetAllWorkspacesAndProjectsDocument,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import { Alert } from '@/ui/Alert';
import Input from '@/ui/v2/Input';
import { discordAnnounce } from '@/utils/discordAnnounce';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useApolloClient } from '@apollo/client';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface BaseDirectoryFormValues {
  /**
   * The relative path where the `nhost` folder is located.
   */
  nhostBaseFolder: string;
}

export default function BaseDirectorySettings() {
  const { maintenanceActive } = useUI();
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateApp] = useUpdateApplicationMutation();
  const client = useApolloClient();

  const form = useForm<BaseDirectoryFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      nhostBaseFolder: currentProject?.nhostBaseFolder,
    },
  });

  const { register, formState, reset } = form;

  useEffect(() => {
    reset(() => ({
      nhostBaseFolder: currentProject?.nhostBaseFolder,
    }));
  }, [currentProject?.nhostBaseFolder, reset]);

  const handleBaseFolderChange = async (values: BaseDirectoryFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        appId: currentProject.id,
        app: {
          ...values,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `The base directory is being updated...`,
        success: `The base directory has been updated successfully.`,
        error: getServerError(
          `An error occurred while trying to update the project's base directory.`,
        ),
      },
      getToastStyleProps(),
    );

    form.reset(values);

    try {
      await client.refetchQueries({
        include: [GetAllWorkspacesAndProjectsDocument],
      });
    } catch (error) {
      await discordAnnounce(
        error.message || 'Error while trying to update application cache',
      );
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleBaseFolderChange}>
        <SettingsContainer
          title="Base Directory"
          description={
            <>
              The base directory is where the{' '}
              <InlineCode className="text-xs">nhost</InlineCode> directory is
              located. In other words, the base directory is the parent
              directory of the{' '}
              <InlineCode className="text-xs">nhost</InlineCode> folder.
            </>
          }
          slotProps={{
            submitButton: {
              disabled: !formState.isDirty || maintenanceActive,
              loading: formState.isSubmitting,
            },
          }}
          docsLink="https://docs.nhost.io/platform/github-integration#base-directory"
          className="grid grid-flow-row lg:grid-cols-5"
        >
          {currentProject?.githubRepository ? (
            <Input
              {...register('nhostBaseFolder')}
              name="nhostBaseFolder"
              id="nhostBaseFolder"
              className="col-span-2"
              fullWidth
              hideEmptyHelperText
            />
          ) : (
            <Alert className="col-span-5 text-left">
              To change the Base Folder, you first need to connect your project
              to a GitHub repository.
            </Alert>
          )}
        </SettingsContainer>
      </Form>{' '}
    </FormProvider>
  );
}
