#!/bin/bash
dir=$(realpath $(dirname $0))

cd "$dir/packages/core"

# Clean all packages
for package in $(printf '%s ' $dir/packages/*); do
  cd $package
  name=$(jq -r .name package.json)
  echo "Cleaning package $name"
  npm run clean
done

# Return to core package directory
cd "$dir/packages/core"

npm run build

for package in $(printf '%s ' $dir/packages/*); do
  if [ "$package" = "$dir/packages/core" ]; then
    continue
  fi

  cd $package
  name=$(jq -r .name package.json)
  echo "Building package $name"
  npm run build
done
