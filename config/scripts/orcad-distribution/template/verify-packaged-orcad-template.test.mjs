import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  ORCAD_NODE_RUNTIME_MARKER_FILENAME,
  ORCAD_TEMPLATE_MANIFEST_FILENAME,
  ORCAD_TEMPLATE_TARGETS_DIR
} from '../../../../src/shared/orcad-artifacts.ts'
import { writeOrcadTemplateTestFixture } from './orcad-template-test-fixture.mjs'

const require = createRequire(import.meta.url)
const { verifyPackagedOrcadTemplate } = require('./verify-packaged-orcad-template.cjs')
const roots = []

async function createFixture(options) {
  const root = await mkdtemp(join(tmpdir(), 'orca-packaged-orcad-template-'))
  roots.push(root)
  const templateDir = await writeOrcadTemplateTestFixture(root, options)
  return { root, templateDir }
}

/** Keep only `keep` targets, as `build-orcad-template.mjs --targets` produces for a local build. */
async function pruneTemplateTargets(templateDir, keep) {
  const manifestPath = join(templateDir, ORCAD_TEMPLATE_MANIFEST_FILENAME)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  for (const target of Object.keys(manifest.targets)) {
    if (!keep.includes(target)) {
      delete manifest.targets[target]
      await rm(join(templateDir, ORCAD_TEMPLATE_TARGETS_DIR, target), { recursive: true })
    }
  }
  await writeFile(manifestPath, JSON.stringify(manifest))
}

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('verifyPackagedOrcadTemplate', () => {
  it('rejects a page asset changed after manifest generation', async () => {
    const fixture = await createFixture()
    await writeFile(join(fixture.templateDir, 'out/mobile-web/index.html'), 'mutated')

    expect(() => verifyPackagedOrcadTemplate(fixture.root)).toThrow(
      'out/mobile-web/index.html checksum mismatch'
    )
  })

  it('rejects a target whose runtime reference names another Node', async () => {
    const fixture = await createFixture()
    const markerPath = join(
      fixture.templateDir,
      ORCAD_TEMPLATE_TARGETS_DIR,
      'darwin-arm64',
      ORCAD_NODE_RUNTIME_MARKER_FILENAME
    )
    await writeFile(markerPath, `${'0'.repeat(64)}\n`)
    const manifestPath = join(fixture.templateDir, ORCAD_TEMPLATE_MANIFEST_FILENAME)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.targets['darwin-arm64'].files[ORCAD_NODE_RUNTIME_MARKER_FILENAME] = createHash(
      'sha256'
    )
      .update(`${'0'.repeat(64)}\n`)
      .digest('hex')
    await writeFile(manifestPath, JSON.stringify(manifest))

    expect(() => verifyPackagedOrcadTemplate(fixture.root)).toThrow(
      'darwin-arm64 runtime reference disagrees'
    )
  })

  // Desktop must carry deployment template on every OS: SSH/managed deploys materialize target slot from resourcesPath (D2).

  it('accepts a partial local template only for the targets ORCA_ORCAD_TEMPLATE_TARGETS names', async () => {
    const fixture = await createFixture()
    await pruneTemplateTargets(fixture.templateDir, ['darwin-arm64'])

    expect(() => verifyPackagedOrcadTemplate(fixture.root)).toThrow('target manifest inventory')

    vi.stubEnv('ORCA_ORCAD_TEMPLATE_TARGETS', 'darwin-arm64')
    expect(() => verifyPackagedOrcadTemplate(fixture.root)).not.toThrow()
  })

  it('refuses a partial target list for release templates', async () => {
    const fixture = await createFixture()
    await pruneTemplateTargets(fixture.templateDir, ['darwin-arm64'])
    vi.stubEnv('ORCA_ORCAD_TEMPLATE_TARGETS', 'darwin-arm64')
    vi.stubEnv('ORCA_REQUIRE_ORCAD_TEMPLATE', '1')

    expect(() => verifyPackagedOrcadTemplate(fixture.root)).toThrow(
      'is refused for release templates'
    )
  })

  it('refuses target names outside the shipped template targets', async () => {
    const fixture = await createFixture()
    vi.stubEnv('ORCA_ORCAD_TEMPLATE_TARGETS', 'darwin-arm64,plan9-mips')

    expect(() => verifyPackagedOrcadTemplate(fixture.root)).toThrow(
      'ORCA_ORCAD_TEMPLATE_TARGETS must be a subset of'
    )
  })
})
