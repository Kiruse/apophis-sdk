#!/bin/bash
case "$1" in
  init)
    if docker ps -a --format '{{.Names}}' | grep -q "^apophis-local-registry$"; then
      echo "Registry container already exists"
      exit 1
    fi
    docker run -d -p 4873:4873 --name apophis-local-registry verdaccio/verdaccio > /dev/null 2>&1
    sleep 2
    npm adduser --registry http://localhost:4873
    ;;
  start)
    docker start apophis-local-registry > /dev/null 2>&1
    ;;
  stop)
    docker stop apophis-local-registry > /dev/null 2>&1
    ;;
  clean)
    docker rm apophis-local-registry > /dev/null 2>&1
    ;;
  *)
    echo "Usage: $0 start|stop|clean|help"
    ;;
esac
