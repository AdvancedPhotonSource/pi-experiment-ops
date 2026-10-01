# pi-experiment-ops

A frontend-independent Pi resource bundle and native CLI launcher.

- Keep upstream packages unchanged and pinned in package.json/npm-shrinkwrap.json.
- lib/index.mjs and lib/index.d.ts define the consumer contract; preserve replacement keys.
- Keep browser transports, frontend schemas, and application metadata out of this package.
- Use the toy workflow for acceptance; physical instruments require separate validation.
- Run npm test and npm run test:package after runtime or packaging changes.
- Release a new version when changing the artifact consumed by another repository.

Commit messages use TAG: message.

## Release checklist

1. Align `package.json.version`, both root version fields in `npm-shrinkwrap.json`, and the default and help text in `install.sh`. Update versioned installer URLs, `--version` arguments, and archive examples in `README.md`, plus any current-release examples in `docs/installation.md` and `.github/MAINTAINING.md`.
2. Add the release to `CHANGELOG.md`. When dependencies change, update exact pins and `npm-shrinkwrap.json`, `THIRD_PARTY.md`, and any affected `pi.extensions`, `pi.skills`, `bundledDependencies`, `lib/resources.json`, and `lib/index.d.ts` entries. Regenerate `requirements.lock` from `scripts/requirements.in` for Python dependency changes.
3. Run `npm test` and `npm run test:package`; run `npm run test:bootstrap` for bootstrap changes. Keep fixed historical test fixtures and earlier changelog entries at their original versions. Verify that `bin/pi` is tracked and executable in the packed artifact.
4. Commit and push the tested source, lockfiles, installer, documentation, release workflow, and this checklist. Tag that commit `vVERSION` and publish the matching GitHub Release in `AdvancedPhotonSource/pi-experiment-ops`.
5. Wait for the `Build release package` workflow to pass and attach `pi-experiment-ops-VERSION.tgz` and `pi-experiment-ops-VERSION.tgz.sha256`. Publishing the release triggers this workflow. Verify the uploaded assets and checksum before updating consumers; generated archives, caches, credentials, and workspaces stay outside Git.
6. In eaa-pi, use the published archive with `scripts/update-pi-bundle.mjs`, refresh its shrinkwrap, and align the dependency, package file list, installed version, and bundle documentation. Follow eaa-pi's release checklist before publishing the application.
