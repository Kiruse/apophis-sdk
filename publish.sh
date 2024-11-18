#!/bin/bash
dir=$(realpath $(dirname $0))

if [ "$1" == "help" ] || [ "$1" == "--help" ]; then
  echo "Usage: $0 [npm|local] - publish to npm or local registry. Default is local."
  exit 0
fi

REGISTRY=""
REGNAME=""

case "$1" in
  npm)
    REGISTRY=""
    REGNAME="npm"
    ;;
  ""|local)
    REGISTRY="--registry http://localhost:4873"
    REGNAME="local"
    ;;
  *)
    echo "Invalid argument: $1"
    exit 1
    ;;
esac

if [ -n "$REGISTRY" ]; then
  # Check if local registry is accessible
  if ! curl -s --head http://localhost:4873 > /dev/null; then
    echo "Error: Local registry is not accessible. Please run 'localreg.sh init|start' first."
    exit 1
  fi
fi

for package in $(printf '%s ' packages/*); do
  cd $dir/$package
  echo "Publishing $package to $REGNAME"
  npm publish --access public $REGISTRY > /dev/null 2>&1
done

echo "Done."
