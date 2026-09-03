#!/bin/sh
set -eu
# Apenas o processo inicial executa a migração, antes de aceitar requisições.
python -c 'from server import init_db; init_db()'
exec gunicorn --config /app/deploy/gunicorn.conf.py wsgi:app
