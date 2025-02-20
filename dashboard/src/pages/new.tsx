import { useDialog } from '@/components/common/DialogProvider';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Container from '@/components/layout/Container';
import { BillingPaymentMethodForm } from '@/components/workspace/BillingPaymentMethodForm';
import { useUI } from '@/context/UIContext';
import features from '@/data/features.json';
import { useSubmitState } from '@/hooks/useSubmitState';
import { Alert } from '@/ui/Alert';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import IconButton from '@/ui/v2/IconButton';
import Input from '@/ui/v2/Input';
import InputAdornment from '@/ui/v2/InputAdornment';
import Option from '@/ui/v2/Option';
import Radio from '@/ui/v2/Radio';
import RadioGroup from '@/ui/v2/RadioGroup';
import Select from '@/ui/v2/Select';
import type { TextProps } from '@/ui/v2/Text';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import CopyIcon from '@/ui/v2/icons/CopyIcon';
import { MAX_FREE_PROJECTS } from '@/utils/CONSTANTS';
import type {
  PrefetchNewAppPlansFragment,
  PrefetchNewAppRegionsFragment,
  PrefetchNewAppWorkspaceFragment,
} from '@/utils/__generated__/graphql';
import {
  GetAllWorkspacesAndProjectsDocument,
  useGetFreeAndActiveProjectsQuery,
  useInsertApplicationMutation,
  usePrefetchNewAppQuery,
} from '@/utils/__generated__/graphql';
import { copy } from '@/utils/copy';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { getCurrentEnvironment } from '@/utils/helpers';
import { planDescriptions } from '@/utils/planDescriptions';
import generateRandomDatabasePassword from '@/utils/settings/generateRandomDatabasePassword';
import { resetDatabasePasswordValidationSchema } from '@/utils/settings/resetDatabasePasswordValidationSchema';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { triggerToast } from '@/utils/toast';
import type { ApolloError } from '@apollo/client';
import { useUserData } from '@nhost/nextjs';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { FormEvent, ReactElement } from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import { toast } from 'react-hot-toast';
import slugify from 'slugify';
import { twMerge } from 'tailwind-merge';

type NewAppPageProps = {
  regions: PrefetchNewAppRegionsFragment[];
  plans: PrefetchNewAppPlansFragment[];
  workspaces: PrefetchNewAppWorkspaceFragment[];
  numberOfFreeAndLiveProjects: number;
  preSelectedWorkspace: PrefetchNewAppWorkspaceFragment;
  preSelectedRegion: PrefetchNewAppRegionsFragment;
};

export function NewProjectPageContent({
  regions,
  plans,
  workspaces,
  numberOfFreeAndLiveProjects,
  preSelectedWorkspace,
  preSelectedRegion,
}: NewAppPageProps) {
  const { openDialog, closeDialog } = useDialog();
  const { maintenanceActive } = useUI();
  const router = useRouter();

  // form
  const [name, setName] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [selectedWorkspace, setSelectedWorkspace] = useState({
    id: preSelectedWorkspace.id,
    name: preSelectedWorkspace.name,
    disabled: false,
    slug: preSelectedWorkspace.slug,
  });

  const [selectedRegion, setSelectedRegion] = useState({
    id: preSelectedRegion.id,
    name: preSelectedRegion.city,
    disabled: false,
    code: preSelectedRegion.country.code,
  });

  const [databasePassword, setDatabasePassword] = useState(
    generateRandomDatabasePassword(),
  );

  // find the first acceptable plan as default plan
  const defaultSelectedPlan = plans.find((plan) => {
    if (!plan.isFree) {
      return true;
    }
    return numberOfFreeAndLiveProjects < MAX_FREE_PROJECTS;
  });

  const [plan, setPlan] = useState(defaultSelectedPlan);

  const { submitState, setSubmitState } = useSubmitState();

  const [insertApp] = useInsertApplicationMutation({
    refetchQueries: [GetAllWorkspacesAndProjectsDocument],
  });

  // options
  const workspaceOptions = workspaces.map((workspace) => ({
    id: workspace.id,
    name: `${workspace.name}`,
    disabled: false,
    slug: workspace.slug,
  }));

  const regionOptions = regions.map((region) => ({
    id: region.id,
    name: region.city,
    code: region.country.code,
    country: region.country.name,
    active: region.active,
    disabled: !region.active,
  }));

  // variables
  const workspace = workspaces.find(
    (availableWorkspace) => availableWorkspace.id === selectedWorkspace.id,
  );

  const isK8SPostgresEnabledInCurrentEnvironment = features[
    'k8s-postgres'
  ].enabled.find((e) => e === getCurrentEnvironment());

  // function handlers
  const handleGenerateRandomPassword = () => {
    const newRandomDatabasePassword = generateRandomDatabasePassword();
    setPasswordError('');
    triggerToast('New random database password generated.');
    setDatabasePassword(newRandomDatabasePassword);
  };

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();

    setSubmitState({
      error: null,
      loading: true,
    });

    if (name.length < 1 || name.length > 32) {
      setSubmitState({
        error: Error('The project name must be between 1 and 32 characters'),
        loading: false,
      });
      return;
    }

    if (isK8SPostgresEnabledInCurrentEnvironment) {
      try {
        await resetDatabasePasswordValidationSchema.validate({
          databasePassword,
        });
      } catch (validationError) {
        setSubmitState({
          error: Error(validationError.errors),
          loading: false,
        });
      }
    }

    const slug = slugify(name, { lower: true, strict: true });

    try {
      await toast.promise(
        insertApp({
          variables: {
            app: {
              name,
              slug,
              planId: plan.id,
              workspaceId: selectedWorkspace.id,
              regionId: selectedRegion.id,
              postgresPassword: isK8SPostgresEnabledInCurrentEnvironment
                ? databasePassword
                : undefined,
            },
          },
        }),
        {
          loading: 'Creating the project...',
          success: 'The project has been created successfully.',
          error: (arg: ApolloError) => {
            // we need to get the internal error message from the GraphQL error
            const { internal } = arg.graphQLErrors[0]?.extensions || {};
            const { message } = (internal as Record<string, any>)?.error || {};

            // we use the default Apollo error message if we can't find the
            // internal error message
            return (
              message ||
              arg.message ||
              'An error occurred while creating the project. Please try again.'
            );
          },
        },
        getToastStyleProps(),
      );

      await router.push(`/${selectedWorkspace.slug}/${slug}`);
    } catch (error) {
      setSubmitState({
        error: null,
        loading: false,
      });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!plan.isFree && workspace.paymentMethods.length === 0) {
      openDialog({
        component: (
          <BillingPaymentMethodForm
            onPaymentMethodAdded={() => {
              handleCreateProject(event);
              closeDialog();
            }}
            workspaceId={workspace.id}
          />
        ),
      });

      return;
    }

    handleCreateProject(event);
  }

  if (!selectedWorkspace) {
    return (
      <Container>
        <Box className="mx-auto my-64 max-w-full subpixel-antialiased">
          <div className="relative transform">
            <div className="mx-auto max-w-3xl text-center">
              <Text variant="h1" className="text-center text-6xl font-semibold">
                Workspace Error
              </Text>
              <Text className="mt-2">
                There is no workspace. You must create a workspace before
                creating an application.
              </Text>
            </div>
          </div>
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <form onSubmit={handleSubmit}>
        <div className="mx-auto grid max-w-[760px] grid-flow-row gap-4 py-6 sm:py-14">
          <Text variant="h2" component="h1">
            New Project
          </Text>

          <div className="grid grid-flow-row gap-4">
            <Input
              id="name"
              autoComplete="off"
              label="Project Name"
              variant="inline"
              fullWidth
              hideEmptyHelperText
              placeholder="Project Name"
              onChange={(event) => {
                setSubmitState({
                  error: null,
                  loading: false,
                });
                setName(event.target.value);
              }}
              value={name}
              autoFocus
            />

            <Select
              id="workspace"
              label="Workspace"
              variant="inline"
              hideEmptyHelperText
              placeholder="Select Workspace"
              slotProps={{
                root: { className: 'grid grid-flow-col gap-1' },
              }}
              onChange={(_event, value) => {
                const workspaceInList = workspaces.find(
                  ({ id }) => id === value,
                );

                if (numberOfFreeAndLiveProjects >= MAX_FREE_PROJECTS) {
                  setPlan(plans.find((currentPlan) => !currentPlan.isFree));
                } else {
                  setPlan(plans[0]);
                }

                setSelectedWorkspace({
                  id: workspaceInList.id,
                  name: workspaceInList.name,
                  disabled: false,
                  slug: workspaceInList.slug,
                });
              }}
              value={selectedWorkspace.id}
              renderValue={(option) => (
                <span className="inline-grid grid-flow-col items-center gap-2">
                  {option?.label}
                </span>
              )}
            >
              {workspaceOptions.map((option) => (
                <Option
                  value={option.id}
                  key={option.id}
                  className="grid grid-flow-col items-center gap-2"
                >
                  <span className="inline-block h-6 w-6 overflow-hidden rounded-md">
                    <Image
                      src="/logos/new.svg"
                      alt="Nhost Logo"
                      width={24}
                      height={24}
                    />
                  </span>

                  {option.name}
                </Option>
              ))}
            </Select>

            {isK8SPostgresEnabledInCurrentEnvironment && (
              <Input
                name="databasePassword"
                id="databasePassword"
                autoComplete="new-password"
                label="Database Password"
                value={databasePassword}
                variant="inline"
                type="password"
                error={!!passwordError}
                hideEmptyHelperText
                endAdornment={
                  <InputAdornment position="end" className="mr-2">
                    <IconButton
                      color="secondary"
                      onClick={() => {
                        copy(databasePassword, 'Postgres password');
                      }}
                      variant="borderless"
                      aria-label="Copy password"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </IconButton>
                  </InputAdornment>
                }
                slotProps={{
                  // Note: this is supposed to fix a `validateDOMNesting` error
                  helperText: { component: 'div' },
                }}
                helperText={
                  <div className="grid max-w-xs grid-flow-row gap-2">
                    {passwordError && (
                      <Text
                        variant="subtitle2"
                        sx={{
                          color: (theme) =>
                            `${theme.palette.error.main} !important`,
                        }}
                      >
                        {passwordError}
                      </Text>
                    )}

                    <Box className="font-medium">
                      The root Postgres password for your database - it must be
                      strong and hard to guess.{' '}
                      <Button
                        type="button"
                        variant="borderless"
                        color="secondary"
                        onClick={handleGenerateRandomPassword}
                        className="px-1 py-0.5 text-xs underline underline-offset-2 hover:underline"
                        tabIndex={-1}
                      >
                        Generate a password
                      </Button>
                    </Box>
                  </div>
                }
                onChange={async (e) => {
                  e.preventDefault();
                  setSubmitState({
                    error: null,
                    loading: false,
                  });
                  setDatabasePassword(e.target.value);

                  try {
                    await resetDatabasePasswordValidationSchema.validate({
                      databasePassword: e.target.value,
                    });
                    setPasswordError('');
                  } catch (validationError) {
                    setPasswordError(validationError.message);
                  }
                }}
                fullWidth
              />
            )}

            <Select
              id="region"
              label="Region"
              variant="inline"
              hideEmptyHelperText
              placeholder="Select Region"
              slotProps={{
                root: { className: 'grid grid-flow-col gap-1' },
              }}
              onChange={(_event, value) => {
                const regionInList = regions.find(({ id }) => id === value);
                setSelectedRegion({
                  id: regionInList.id,
                  name: regionInList.country.name,
                  disabled: false,
                  code: regionInList.country.code,
                });
              }}
              value={selectedRegion.id}
              renderValue={(option) => {
                const [flag, , country] = (option?.label as any[]) || [];

                return (
                  <span className="inline-grid grid-flow-col grid-rows-none items-center gap-x-2">
                    {flag}

                    {isValidElement<TextProps>(country)
                      ? cloneElement(country, {
                          ...country.props,
                          variant: 'body1',
                        })
                      : null}
                  </span>
                );
              }}
            >
              {regionOptions.map((option) => (
                <Option
                  value={option.id}
                  key={option.id}
                  className={twMerge(
                    'relative grid grid-flow-col grid-rows-2 items-center justify-start gap-x-3',
                    option.disabled && 'pointer-events-none opacity-50',
                  )}
                  disabled={option.disabled}
                >
                  <span className="row-span-2 flex">
                    <Image
                      src={`/assets/flags/${option.code}.svg`}
                      alt={`${option.country} country flag`}
                      width={16}
                      height={12}
                    />
                  </span>

                  <Text className="row-span-1 font-medium">{option.name}</Text>

                  <Text variant="subtitle2" className="row-span-1">
                    {option.country}
                  </Text>

                  {option.disabled && (
                    <Text
                      variant="subtitle2"
                      className="absolute top-1/2 right-4 -translate-y-1/2"
                    >
                      Disabled
                    </Text>
                  )}
                </Option>
              ))}
            </Select>

            <div className="grid w-full grid-cols-8 gap-x-4 gap-y-2">
              <div className="col-span-8 sm:col-span-2">
                <Text className="text-xs font-medium">Plan</Text>
                <Text variant="subtitle2">You can change this later.</Text>
              </div>

              <RadioGroup
                value={plan.id}
                onChange={(_event, value) => {
                  setPlan(plans.find((p) => p.id === value));
                }}
                className="col-span-8 space-y-2 sm:col-span-6"
              >
                {plans.map((currentPlan) => {
                  const disabledPlan =
                    currentPlan.isFree &&
                    numberOfFreeAndLiveProjects >= MAX_FREE_PROJECTS;

                  return (
                    <Tooltip
                      visible={disabledPlan}
                      title="Only one free project can be active at any given time. Please pause your active free project before creating a new one."
                      key={currentPlan.id}
                      slotProps={{
                        tooltip: { className: '!max-w-xs w-full text-center' },
                      }}
                    >
                      <Box className="w-full rounded-md border">
                        <Radio
                          slotProps={{
                            formControl: {
                              className: 'p-3 w-full',
                              slotProps: {
                                typography: { className: 'w-full' },
                              },
                            },
                          }}
                          value={currentPlan.id}
                          disabled={disabledPlan}
                          label={
                            <div className="flex w-full items-center justify-between ">
                              <div className="inline-block max-w-xs">
                                <Text className="font-medium text-[inherit]">
                                  {currentPlan.name}
                                </Text>
                                <Text className="text-xs text-[inherit]">
                                  {planDescriptions[currentPlan.name]}
                                </Text>
                              </div>

                              {currentPlan.isFree ? (
                                <Text
                                  variant="h3"
                                  component="span"
                                  className="text-[inherit]"
                                >
                                  Free
                                </Text>
                              ) : (
                                <Text variant="h3" component="span">
                                  ${currentPlan.price}/mo
                                </Text>
                              )}
                            </div>
                          }
                        />
                      </Box>
                    </Tooltip>
                  );
                })}
              </RadioGroup>
            </div>
          </div>

          {submitState.error && (
            <Alert severity="error" className="text-left">
              <Text className="font-medium">Error</Text>{' '}
              <Text className="font-medium">
                {submitState.error &&
                  getErrorMessage(submitState.error, 'application')}{' '}
              </Text>
            </Alert>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={submitState.loading}
              disabled={!!passwordError || maintenanceActive}
              id="create-app"
            >
              Create Project
            </Button>
          </div>
        </div>
      </form>
    </Container>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const user = useUserData();

  const { data, loading, error } = usePrefetchNewAppQuery({
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: freeAndActiveProjectsData,
    loading: freeAndActiveProjectsLoading,
    error: freeAndActiveProjectsError,
  } = useGetFreeAndActiveProjectsQuery({
    variables: { userId: user?.id },
    fetchPolicy: 'cache-and-network',
  });

  if (error || freeAndActiveProjectsError) {
    throw error || freeAndActiveProjectsError;
  }

  if (loading || freeAndActiveProjectsLoading) {
    return (
      <ActivityIndicator delay={500} label="Loading plans and regions..." />
    );
  }

  const { workspace } = router.query;
  const { regions, plans, workspaces } = data;

  // get pre-selected workspace
  // use query param to get workspace or just pick first workspace
  const preSelectedWorkspace = workspace
    ? workspaces.find((w) => w.slug === workspace)
    : workspaces[0];

  const preSelectedRegion = regions.find((region) => region.active);

  return (
    <NewProjectPageContent
      regions={regions}
      plans={plans}
      workspaces={workspaces}
      numberOfFreeAndLiveProjects={
        freeAndActiveProjectsData?.freeAndActiveProjects.length
      }
      preSelectedWorkspace={preSelectedWorkspace}
      preSelectedRegion={preSelectedRegion}
    />
  );
}

NewProjectPage.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticatedLayout title="New Project">{page}</AuthenticatedLayout>;
};
