#!/bin/bash
dir=$(realpath $(dirname $0))

# Parse arguments
PACKAGES=()
REGISTRY="--registry http://localhost:4873"
REGNAME="local"

# Show help
show_help() {
  echo "Usage: $0 [--npm] [all|package1 [package2 ...]]"
  echo "  --npm    Publish to npm registry instead of local registry"
  echo "  all      Publish all packages in the packages directory"
  echo "  package  One or more package names to publish (e.g., core ui)"
  echo ""
  echo "Examples:"
  echo "  $0 all"
  echo "  $0 keplr-signer cosmos-signers"
  echo "  $0 --npm core"
  exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      show_help
      ;;
    --npm)
      REGISTRY=""
      REGNAME="npm"
      shift
      ;;
    *)
      PACKAGES+=("$1")
      shift
      ;;
  esac
done

# Check if any packages were specified
if [ ${#PACKAGES[@]} -eq 0 ]; then
  echo "Error: No packages specified"
  show_help
fi

if [ "$REGNAME" == "local" ]; then
  # Check if local registry is accessible
  if ! curl -s --head http://localhost:4873 > /dev/null; then
    echo "Error: Local registry is not accessible. Please run 'localreg.sh init|start' first."
    exit 1
  fi
fi

# Handle "all" packages case
if [ "${PACKAGES[0]}" == "all" ]; then
  if [ ${#PACKAGES[@]} -gt 1 ]; then
    echo "Warning: Additional arguments after 'all' will be ignored"
  fi
  PACKAGES=($(printf '%s ' packages/*))
else
  # Add packages/ prefix to each package name
  PACKAGES=("${PACKAGES[@]/#/packages/}")
fi

for package in "${PACKAGES[@]}"; do
  if [ ! -d "$dir/$package" ]; then
    echo "Error: Package directory '$package' does not exist"
    continue
  fi
  cd "$dir/$package"
  echo "Publishing $package to $REGNAME"
  npm publish --access public $REGISTRY
done

echo "Done."
