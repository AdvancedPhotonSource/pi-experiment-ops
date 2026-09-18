# Maintainer guide

## Checks and dependency updates

After updating the pinned npm dependencies, update `npm-shrinkwrap.json`. For Python dependency changes, regenerate `requirements.lock`:

```bash
uv pip compile --python-version 3.12 --generate-hashes scripts/requirements.in -o requirements.lock
```

Run the runtime and package-install checks:

```bash
npm ci --legacy-peer-deps
bash scripts/install.sh --runtime-only
npm test
npm run test:package
```

The tests use a local streaming model endpoint, actual Pi extensions, and real pi-graph child processes. Provider tests check Argo request identity and environment-based API keys. Live-provider behavior and physical instruments require separate validation.

`npm run test:bootstrap` additionally checks the piped installer on a machine where `/usr/bin:/bin` contains no Node executable. The release workflow uses the package-install suite on GitHub's pre-provisioned runner.

## Publishing a release

1. Match the version in `package.json`, both root version fields in `npm-shrinkwrap.json`, and the default `version` in `install.sh`. Update the README's versioned installation examples.
2. Commit and push the source, lockfiles, launcher scripts (including `bin/pi`), and [release workflow](workflows/release.yml).
3. Publish a GitHub Release at that commit with the matching tag, such as `v0.1.1`.
4. Wait for **Actions → Build release package** to pass and attach the `.tgz` and `.tgz.sha256` assets. The curl installer becomes usable when both assets are available.

The workflow runs on `release: published`, including published prereleases. It validates versions, provisions dependencies, runs the checks above, and uploads assets with the automatic `GITHUB_TOKEN`. Actions policy must allow the pinned actions and `contents: write`. No npm publishing token or model credentials are required. Saving a draft or pushing a tag alone does not trigger the workflow.

The upload step sends each asset separately and retries failures up to five times, waiting 5, 10, 20, and 40 seconds between attempts. A persistent failure leaves the job failed. Use **Re-run failed jobs** for transient GitHub upload errors; reruns replace matching asset names. Publish a new version for source fixes. For manual recovery, run the checks above, then build and upload these files to the matching release:

```bash
npm pack
sha256sum pi-experiment-ops-0.1.1.tgz > pi-experiment-ops-0.1.1.tgz.sha256
```

Keep generated tarballs, checksums, dependency directories, and Python environments out of Git. Retain previous release assets for rollback.
