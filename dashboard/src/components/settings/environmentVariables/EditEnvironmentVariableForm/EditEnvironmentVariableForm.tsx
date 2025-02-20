import type {
  BaseEnvironmentVariableFormProps,
  BaseEnvironmentVariableFormValues,
} from '@/components/settings/environmentVariables/BaseEnvironmentVariableForm';
import BaseEnvironmentVariableForm, {
  baseEnvironmentVariableFormValidationSchema,
} from '@/components/settings/environmentVariables/BaseEnvironmentVariableForm';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import type { EnvironmentVariable } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import {
  GetEnvironmentVariablesDocument,
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/utils/__generated__/graphql';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditEnvironmentVariableFormProps
  extends Pick<BaseEnvironmentVariableFormProps, 'onCancel' | 'location'> {
  /**
   * The environment variable to edit.
   */
  originalEnvironmentVariable: EnvironmentVariable;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditEnvironmentVariableForm({
  originalEnvironmentVariable,
  onSubmit,
  ...props
}: EditEnvironmentVariableFormProps) {
  const form = useForm<BaseEnvironmentVariableFormValues>({
    defaultValues: {
      id: originalEnvironmentVariable.id || '',
      name: originalEnvironmentVariable.name || '',
      value: originalEnvironmentVariable.value || '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseEnvironmentVariableFormValidationSchema),
  });

  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data, loading, error } = useGetEnvironmentVariablesQuery({
    variables: { appId: currentProject?.id },
    fetchPolicy: 'cache-only',
  });

  const availableEnvironmentVariables = data?.config?.global?.environment || [];

  const [updateConfig] = useUpdateConfigMutation({
    refetchQueries: [GetEnvironmentVariablesDocument],
  });

  if (loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading environment variables..."
      />
    );
  }

  if (error) {
    throw error;
  }

  const { setError } = form;

  async function handleSubmit({
    id,
    name,
    value,
  }: BaseEnvironmentVariableFormValues) {
    if (
      availableEnvironmentVariables.some(
        (variable) =>
          variable.name === name &&
          variable.name !== originalEnvironmentVariable.name,
      )
    ) {
      setError('name', {
        message: 'This environment variable already exists.',
      });

      return;
    }

    const updateConfigPromise = updateConfig({
      variables: {
        appId: currentProject?.id,
        config: {
          global: {
            environment: [
              ...availableEnvironmentVariables
                .filter((variable) => variable.id !== id)
                .map((variable) => ({
                  name: variable.name,
                  value: variable.value,
                })),
              {
                name,
                value,
              },
            ],
          },
        },
      },
    });

    await toast.promise(
      updateConfigPromise,
      {
        loading: 'Updating environment variable...',
        success: 'Environment variable has been updated successfully.',
        error: getServerError(
          'An error occurred while updating the environment variable.',
        ),
      },
      getToastStyleProps(),
    );

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseEnvironmentVariableForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}
