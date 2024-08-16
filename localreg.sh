#!/bin/bash
# sets up & runs a local package registry
docker run --rm -p 4873:4873 --name local-npm verdaccio/verdaccio
