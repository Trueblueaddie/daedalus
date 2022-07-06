#!/usr/bin/env bash
set -e
source "$(dirname "$0")/utils.sh"

rootDir=$(dirname "$0")/..
BUILDKITE_BUILD_NUMBER="$1"

# We have to pass it somehow to the flake…
if [ -n "$BUILDKITE_BUILD_NUMBER" ] && [ "$BUILDKITE_BUILD_NUMBER" != 0 ] ; then
  echo "$BUILDKITE_BUILD_NUMBER" > .build-number
  if [ -n "${BUILDKITE_JOB_ID:-}" ]; then # if in real Buildkite,
    git update-index --assume-unchanged .build-number # lie to Nix that the repo was unchanged, more impurity…
  fi
fi

upload_artifacts() {
  retry 5 buildkite-agent artifact upload "$@" --job "$BUILDKITE_JOB_ID"
}

upload_artifacts_public() {
  retry 5 buildkite-agent artifact upload "$@" "${ARTIFACT_BUCKET:-}" --job "$BUILDKITE_JOB_ID"
}

CLUSTERS="$(xargs echo -n < "$(dirname "$0")/../installer-clusters.cfg")"

for cluster in ${CLUSTERS}; do
  echo '~~~ Building '"${cluster}"' installer'
  nix build --show-trace -L "${rootDir}#daedalus-x86_64-windows.installer.${cluster}"
  if [ -n "${BUILDKITE_JOB_ID:-}" ]; then
    upload_artifacts_public result/daedalus-*-*.exe
  fi
done
