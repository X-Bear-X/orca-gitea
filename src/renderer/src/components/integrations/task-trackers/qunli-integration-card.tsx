import { taskProviderErrorMessage } from '@/lib/work-items/task-provider-error-copy'
import { UnsealedCredentialNotice } from '../../provider-accounts/UnsealedCredentialNotice'
import { useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Unlink } from 'lucide-react'
import { QunliIcon } from '@/components/icons/QunliIcon'
import { QunliConnectDialog } from '@/components/qunli-connect-dialog'
import { Button } from '@/components/ui/button'
import { useMountedRef } from '@/hooks/useMountedRef'
import { getProviderRuntimeContextKey } from '@/runtime/hosts/observations/provider-runtime-context'
import { useAppStore } from '@/store/index'
import {
  IntegrationCardDetails,
  IntegrationCardShell
} from '../presentation/integration-card-shell'
import { useIntegrationSubordinateRowClass } from '../presentation/integration-card-presentation'
import { QUNLI_INTEGRATION_SECTION_ID } from './task-provider-integration-section-ids'
import { useTranslate } from '@/i18n/use-translate'

type VerificationResult = { state: 'ok' } | { state: 'error'; error: string }

export function QunliIntegrationCard(): React.JSX.Element {
  const t = useTranslate()
  const qunliStatus = useAppStore((s) => s.qunliStatus)
  const qunliStatusChecked = useAppStore((s) => s.qunliStatusChecked)
  const qunliStatusContextKey = useAppStore((s) => s.qunliStatusContextKey)
  const disconnectQunli = useAppStore((s) => s.disconnectQunli)
  const testQunliConnection = useAppStore((s) => s.testQunliConnection)
  const checkQunliConnection = useAppStore((s) => s.checkQunliConnection)
  const settings = useAppStore((s) => s.settings)
  const mountedRef = useMountedRef()
  const subordinateRowClass = useIntegrationSubordinateRowClass('flex items-center gap-3')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<VerificationResult | null>(null)

  const contextMatches = qunliStatusContextKey === getProviderRuntimeContextKey(settings)
  const checking = !contextMatches || !qunliStatusChecked
  const connected = contextMatches && qunliStatus.connected
  const viewer = qunliStatus.viewer

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    const result = await testQunliConnection()
    if (!mountedRef.current) {
      return
    }
    setTestResult(
      result.ok ? { state: 'ok' } : { state: 'error', error: taskProviderErrorMessage(result) }
    )
    setTesting(false)
  }

  return (
    <IntegrationCardShell
      settingsSectionId={QUNLI_INTEGRATION_SECTION_ID}
      icon={<QunliIcon className="size-5" />}
      name={t('taskProviders.qunli.name', 'Qunli')}
      description={
        connected && viewer
          ? t('taskProviders.qunli.connectedAs', '{{team}} · tasks of {{manager}}', {
              team: viewer.accountName,
              manager: viewer.managerName ?? viewer.agentName
            })
          : checking
            ? t('taskProviders.qunli.checking', 'Checking Qunli access.')
            : t(
                'taskProviders.qunli.notConnectedHint',
                'Add a Qunli agent key to browse your cards.'
              )
      }
      checking={checking}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={
        connected
          ? t('taskProviders.qunli.statusConnected', 'Connected')
          : t('taskProviders.qunli.statusNotConnected', 'Not connected')
      }
      actions={
        !checking ? (
          <Button
            variant={connected ? 'outline' : 'default'}
            size="sm"
            onClick={() => setDialogOpen(true)}
          >
            {connected
              ? t('taskProviders.qunli.replaceKey', 'Replace key')
              : t('taskProviders.qunli.addAccess', 'Add Qunli access')}
          </Button>
        ) : null
      }
    >
      <IntegrationCardDetails>
        <UnsealedCredentialNotice
          protection={qunliStatus.credentialProtection ?? null}
          credentialName={t('taskProviders.qunli.keyName', 'Your Qunli agent key')}
        />
        {qunliStatus.credentialError ? (
          <p className="text-xs text-destructive">{qunliStatus.credentialError}</p>
        ) : null}
        {connected ? (
          <div className={subordinateRowClass}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {viewer?.accountName ?? ''}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {viewer
                  ? t('taskProviders.qunli.agentLine', 'Agent {{agent}} · managed by {{manager}}', {
                      agent: viewer.agentName,
                      manager: viewer.managerName ?? '-'
                    })
                  : ''}
              </p>
            </div>
            {testResult?.state === 'ok' ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-status-success">
                <CheckCircle2 className="size-3.5" />
                {t('taskProviders.qunli.verified', 'Verified')}
              </span>
            ) : null}
            {testResult?.state === 'error' ? (
              <span className="flex min-w-0 max-w-[220px] shrink items-center gap-1 truncate text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                <span className="truncate">{testResult.error}</span>
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {testing ? (
                <>
                  <LoaderCircle className="size-3.5 mr-1.5 animate-spin" />
                  {t('taskProviders.qunli.testing', 'Testing...')}
                </>
              ) : (
                t('taskProviders.qunli.test', 'Test')
              )}
            </Button>
            <button
              onClick={() => {
                setTestResult(null)
                void disconnectQunli()
              }}
              aria-label={t('taskProviders.qunli.disconnect', 'Disconnect Qunli')}
              className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
            >
              <Unlink className="size-3.5" />
            </button>
          </div>
        ) : !checking ? (
          <Button variant="ghost" size="sm" onClick={() => void checkQunliConnection()}>
            {t('taskProviders.qunli.recheck', 'Re-check')}
          </Button>
        ) : null}
      </IntegrationCardDetails>

      <QunliConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={() => setTestResult(null)}
      />
    </IntegrationCardShell>
  )
}
