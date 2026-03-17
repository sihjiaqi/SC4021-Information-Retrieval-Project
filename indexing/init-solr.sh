#!/bin/bash
set -e

echo "Starting Solr in cloud mode..."

solr start -c -force

echo "Waiting for Solr to start..."
sleep 20

echo "Uploading config to Zookeeper..."

solr zk upconfig \
  -n opinion_config \
  -d /opt/solr/configsets/opinion_config \
  -z localhost:9983

echo "Creating collection..."

solr create_collection \
  -c opinion \
  -n opinion_config \
  --shards 1 \
  --replication-factor 1

echo "Posting data..."

solr post -c opinion /opt/solr/data/solr_docs.json

echo "Solr setup complete."

tail -f /dev/null