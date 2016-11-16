#!/bin/sh
# access a runtime redis
#docker-compose run redis redis-cli -h redis
echo 'Add port to redis'
redis-bash-cli -h 172.18.0.1 SADD serverSet $1
echo 'Start the container'
docker run -d -p $1:3000 --link hw4_redis_1:redis --network=hw4_default hw4_app