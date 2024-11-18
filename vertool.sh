#!/bin/bash
if [[ -z "$1" || -z "$2" ]]; then
  echo "Usage: vertool.sh bump <major|minor|patch> -OR-"
  echo "Usage: vertool.sh suffix set <suffix> -OR-"
  echo "Usage: vertool.sh suffix clear"
  echo "Usage: vertool.sh set <version> (careful: does not ensure version is valid)"
  exit 1
fi

command=$1
shift

cd "$(dirname "$0")"

version=$(jq -r .version package.json)

bump_version() {
  local which=$1
  local major=$(echo $version | cut -d. -f1)
  local minor=$(echo $version | cut -d. -f2)
  local patch=$(echo $version | cut -d. -f3 | cut -d- -f1)

  case $which in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
  esac

  write_version "$major.$minor.$patch"
}

suffix_set() {
  local suffix=$1
  local version_base=$(cut -d- -f1 <<< $version)
  local new_version="$version_base-$suffix"
  write_version $new_version
}

suffix_clear() {
  local version_base=$(cut -d- -f1 <<< $version)
  write_version $version_base
}

write_version() {
  for filepath in $(printf '%s ' "./package.json ./packages/*/package.json"); do
    jq --arg version "$1" '.version = $version' "$filepath" > "$filepath.tmp" && mv "$filepath.tmp" "$filepath"
  done

  for filepath in $(printf '%s ' "./packages/*/package.json"); do
    if [ $filepath != "./packages/core/package.json" ]; then
      jq --arg version "$1" '(.peerDependencies | with_entries(if .key | startswith("@apophis-sdk/") then .value = $version else . end)) as $newPeerDeps | .peerDependencies = $newPeerDeps' "$filepath" > "$filepath.tmp" && mv "$filepath.tmp" "$filepath"
    fi
  done
}

case $command in
  bump)
    case "$1" in
      major|minor|patch)
        ;;
      *)
        echo "Invalid bump type: $1. Available: major, minor, patch">&2
        exit 1
        ;;
    esac
    bump_version $1
    ;;
  suffix)
    subcommand=$1
    shift

    case $subcommand in
      set)
        if [[ -z "$1" ]]; then
          echo "No suffix provided">&2
          exit 1
        fi
        suffix_set $1
        ;;
      clear)
        suffix_clear
        ;;
      *)
        echo "Invalid suffix subcommand: $subcommand. Available: set, clear">&2
        exit 1
        ;;
    esac
    ;;
  set)
    if [[ -z "$1" ]]; then
      echo "No version provided">&2
      exit 1
    fi
    write_version $1
    ;;
  *)
    echo "Invalid command: $command. Available: bump, suffix">&2
    exit 1
    ;;
esac

version=$(jq -r .version ./package.json)
echo "Done. New version is $version"
