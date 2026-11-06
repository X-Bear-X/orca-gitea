import { ExternalLink, GitPullRequestArrow, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IntegrationCardShell } from '../presentation/integration-card-shell'
import { useIntegrationCommandRowClass } from '../presentation/integration-card-presentation'
import {
  integrationStatusLabel,
  ProviderAccountScopeDetails
} from './cli-source-control-integration-cards'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'
import { translate } from '@/i18n/i18n'
import { openAppHttpLink } from '@/lib/app-http-link-open'

const GT_INSTALL_URL = 'https://gitea.com/gitea/cli#installation'
const GT_LOGIN_DOCS_URL = 'https://gitea.com/gitea/cli#log-in-to-gitea-from-gt'

export function GiteaIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('gitea')
  const status = unavailable ? 'unavailable' : statuses.giteaStatus
  const connected = status === 'connected'
  const commandRowClass = useIntegrationCommandRowClass()
  const reCheckLabel = translate(
    'auto.components.settings.cli.source.control.integration.cards.d5b3be8ecd',
    'Re-check'
  )

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Gitea"
      description={
        <>
          {translate(
            'auto.components.settings.cli.source.control.integration.cards.giteaViaPrefix',
            'Pull requests, Actions jobs, and comments via the'
          )}{' '}
          <span className="font-mono text-[11px]">
            {statuses.giteaCli === 'tea' ? 'tea' : 'gt'}
          </span>{' '}
          {translate(
            'auto.components.settings.cli.source.control.integration.cards.a47f71e357',
            'CLI.'
          )}
          {connected && statuses.giteaAccount ? (
            <span className="block">{statuses.giteaAccount}</span>
          ) : null}
        </>
      }
      checking={status === 'checking'}
      statusTone={connected ? 'connected' : 'attention'}
      statusLabel={integrationStatusLabel(status)}
    >
      <ProviderAccountScopeDetails>
        {status !== 'checking' && !connected ? (
          status === 'unavailable' ? (
            <>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.cli.source.control.integration.cards.giteaUnavailable',
                  'Gitea CLI status is not available in this runtime yet.'
                )}
              </p>
              <Button variant="ghost" size="sm" onClick={refresh}>
                {reCheckLabel}
              </Button>
            </>
          ) : status === 'not-installed' ? (
            <>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.cli.source.control.integration.cards.giteaInstallHint',
                  'Install the Gitea CLI (gt) to enable pull requests, Actions jobs, and comments.'
                )}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => openAppHttpLink(GT_INSTALL_URL, { event })}
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  {translate(
                    'auto.components.settings.cli.source.control.integration.cards.giteaInstall',
                    'Install Gitea CLI'
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  {reCheckLabel}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.cli.source.control.integration.cards.giteaLoginHint',
                  'The Gitea CLI is installed but has no login for your server. Run this command in a terminal:'
                )}
              </p>
              <div className={commandRowClass}>
                <Terminal className="size-3.5 shrink-0 text-muted-foreground" />
                {translate(
                  'auto.components.settings.cli.source.control.integration.cards.giteaLoginCommand',
                  'gt auth login --host <gitea-url>'
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(event) => openAppHttpLink(GT_LOGIN_DOCS_URL, { event })}
                >
                  <ExternalLink className="size-3.5 mr-1.5" />
                  {translate(
                    'auto.components.settings.cli.source.control.integration.cards.8cbc39f862',
                    'Learn more'
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={refresh}>
                  {reCheckLabel}
                </Button>
              </div>
            </>
          )
        ) : null}
      </ProviderAccountScopeDetails>
    </IntegrationCardShell>
  )
}
