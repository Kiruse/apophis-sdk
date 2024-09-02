#!/bin/bash
dir=$(realpath $(dirname $0))

for package in $(printf '%s ' $dir/packages/*); do
  cd $package
  rm -rf dist
  name=$(jq -r .name package.json)
  echo "Building package $name"
  npm run clean
  npm run build
done
