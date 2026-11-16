import { useState } from 'react'
import { QunliConnectDialog } from '@/components/qunli-connect-dialog'
import { Button } from '@/components/ui/button'
import { TaskSourceShowInTasksStep } from './TaskSourceShowInTasksStep'
import { TaskSourceStepRow } from './TaskSourceStepRow'
import { useTranslate } from '@/i18n/use-translate'
import { getConnectStepState, type ConnectStepProps } from './task-source-setup-state'

export function QunliSetupSteps(
  props: ConnectStepProps & { onOpenIntegrations: () => void }
): React.JSX.Element {
  const t = useTranslate()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <ol className="divide-y divide-border/50">
        <TaskSourceStepRow
          index={1}
          state={getConnectStepState(props)}
          title={t('taskProviders.qunli.connectTitle', 'Connect Qunli')}
          description={t(
            'taskProviders.qunli.setupDescription',
            'Paste the API key of a Qunli agent you manage.'
          )}
          action={
            <Button
              type="button"
              size="sm"
              variant={props.connected ? 'outline' : 'default'}
              onClick={props.connected ? props.onOpenIntegrations : () => setDialogOpen(true)}
            >
              {props.connected
                ? t('taskProviders.qunli.manageKey', 'Manage key')
                : t('taskProviders.qunli.addAccess', 'Add Qunli access')}
            </Button>
          }
        />
        <TaskSourceShowInTasksStep
          index={2}
          providerLabel={t('taskProviders.qunli.name', 'Qunli')}
          visible={props.visible}
          canHide={props.canHide}
          onToggleVisible={props.onToggleVisible}
        />
      </ol>
      <QunliConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
