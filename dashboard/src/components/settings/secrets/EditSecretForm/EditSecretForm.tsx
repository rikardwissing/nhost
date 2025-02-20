import type {
  BaseSecretFormProps,
  BaseSecretFormValues,
} from '@/components/settings/secrets/BaseSecretForm';
import BaseSecretForm, {
  baseSecretFormValidationSchema,
} from '@/components/settings/secrets/BaseSecretForm';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import type { Secret } from '@/types/application';
import {
  GetSecretsDocument,
  useUpdateSecretMutation,
} from '@/utils/__generated__/graphql';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { yupResolver } from '@hookform/resolvers/yup';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface EditSecretFormProps
  extends Pick<BaseSecretFormProps, 'onCancel'> {
  /**
   * The secret to edit.
   */
  originalSecret: Secret;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<void>;
}

export default function EditSecretForm({
  originalSecret,
  onSubmit,
  ...props
}: EditSecretFormProps) {
  const form = useForm<BaseSecretFormValues>({
    defaultValues: {
      name: originalSecret.name,
      value: '',
    },
    reValidateMode: 'onSubmit',
    resolver: yupResolver(baseSecretFormValidationSchema),
  });

  const { currentProject } = useCurrentWorkspaceAndProject();
  const [updateSecret] = useUpdateSecretMutation({
    refetchQueries: [GetSecretsDocument],
  });

  async function handleSubmit({ name, value }: BaseSecretFormValues) {
    const updateSecretPromise = updateSecret({
      variables: {
        appId: currentProject?.id,
        secret: {
          name,
          value,
        },
      },
    });

    try {
      await toast.promise(
        updateSecretPromise,
        {
          loading: 'Updating secret...',
          success: 'Secret has been updated successfully.',
          error: (arg: Error) =>
            arg?.message
              ? `Error: ${arg?.message}`
              : 'An error occurred while updating the secret.',
        },
        getToastStyleProps(),
      );

      onSubmit?.();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <FormProvider {...form}>
      <BaseSecretForm
        mode="edit"
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
