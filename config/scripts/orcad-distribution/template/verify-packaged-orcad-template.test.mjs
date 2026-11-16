import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ORCAD_TEMPLATE_MANIFEST_FILENAME,
  ORCAD_TEMPLATE_TARGETS_DIR
} from '../../../../src/shared/remote-runtime/orcad-distribution/orcad-artifacts.ts'
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
