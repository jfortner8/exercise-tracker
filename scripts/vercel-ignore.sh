#!/usr/bin/env bash
# Vercel's "Ignored Build Step" for apps/web: exit 0 skips the build, exit 1 builds.
# Builds only when something the website is built from changed since the last deployment,
# so commits that touch only apps/mobile, infra or docs don't use a build.
# Any git error (first deploy of a branch, commit missing from the shallow clone) builds.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
cd "$(git rev-parse --show-toplevel)" || exit 1
git diff --quiet "$base" HEAD -- apps/web packages/core package.json package-lock.json scripts/vercel-ignore.sh
status=$?
if [ "$status" -eq 0 ]; then echo "No website changes since $base: skipping the build"; exit 0; fi
exit 1
