#!/bin/bash
dir=$(realpath $(dirname $0))

for package in $(printf '%s ' packages/*); do
  cd $dir/$package
  npm publish --access public --registry http://localhost:4873
done
