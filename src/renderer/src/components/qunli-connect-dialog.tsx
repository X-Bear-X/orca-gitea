import { taskProviderErrorMessage } from '@/lib/work-items/task-provider-error-copy'
import { useId, useState } from 'react'
import { LoaderCircle, Lock } from 'lucide-react'
import { useAppStore } from '@/store/index'
import { useMountedRef } from '@/hooks/useMountedRef'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { preventOutsideDismissWhenDirty } from '@/lib/overlay-interaction/outside-dismiss-guard'
import { useTranslate } from '@/i18n/use-translate'

type QunliConnectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
}

export function QunliConnectDialog({
  open,
  onOpenChange,
  onConnected
}: QunliConnectDialogProps): React.JSX.Element {
  const t = useTranslate()
  const connectQunli = useAppStore((s) => s.connectQunli)
  const mountedRef = useMountedRef()
  const inputId = useId()
  const errorId = useId()
  const [apiKey, setApiKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (nextOpen: boolean): void => {
    if (connecting) {
      return
    }
    if (!nextOpen) {
      setApiKey('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  const guardOutsideDismiss = preventOutsideDismissWhenDirty(() => apiKey !== '')

  const handleConnect = async (): Promise<void> => {
    if (!apiKey.trim() || connecting) {
      return
    }
    setConnecting(true)
    setError(null)
    try {
      const result = await connectQunli(apiKey.trim())
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setApiKey('')
        onOpenChange(false)
        onConnected?.()
      } else {
        setError(taskProviderErrorMessage(result))
      }
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : String(caught))
      }
    } finally {
      if (mountedRef.current) {
        setConnecting(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={guardOutsideDismiss}
        onInteractOutside={guardOutsideDismiss}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && apiKey.trim() && !connecting) {
            event.preventDefault()
            void handleConnect()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('taskProviders.qunli.connectTitle', 'Connect Qunli')}</DialogTitle>
          <DialogDescription>
            {t(
              'taskProviders.qunli.connectDescription',
              'Qunli only gives API keys to agents. Create an agent in Qunli, manage it yourself, and paste its API key here. Orca lists the tasks assigned to you, the agent’s manager.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={inputId}>{t('taskProviders.qunli.apiKeyLabel', 'Agent API key')}</Label>
            <Input
              id={inputId}
              autoFocus
              type="password"
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value)
                setError(null)
              }}
              disabled={connecting}
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
            />
          </div>
          {error ? (
            <p id={errorId} className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Lock className="size-3 shrink-0" />
            {t(
              'taskProviders.qunli.keyStorage',
              'The key is stored by the active runtime, encrypted when the system allows it.'
            )}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={connecting}>
            {t('taskProviders.qunli.cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleConnect()} disabled={!apiKey.trim() || connecting}>
            {connecting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {t('taskProviders.qunli.verifying', 'Verifying...')}
              </>
            ) : (
              t('taskProviders.qunli.connect', 'Connect')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
