FROM solr:9

USER root

COPY opinion_config /opt/solr/configsets/opinion_config
COPY solr_docs.json /opt/solr/data/solr_docs.json
COPY init-solr.sh /init-solr.sh

RUN chmod +x /init-solr.sh

USER solr

CMD ["/init-solr.sh"]