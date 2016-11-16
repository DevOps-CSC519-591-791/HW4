#!/bin/sh
# access a runtime redis
#docker-compose run redis redis-cli -h redis

# echo 'Add port to redis'
# redis-bash-cli -h 172.18.0.1 SADD serverSet $1
# echo 'Start the container'
# docker run -d -p $1:3000 --link hw4_redis_1:redis --network=hw4_default hw4_app

# obtain redis container ip
REDIS_IP=`docker inspect --format '{{ .NetworkSettings.Networks.hw4_default.IPAddress }}' $(docker ps -aqf "name=redis")`

echo 'Count current number of ips'
NUM_OF_IP=$1

# generate new port
NEW_PORT="300$NUM_OF_IP"
echo "Generate new port $NEW_PORT"

echo 'Scale one more `app` container'
docker-compose scale app=$((NUM_OF_IP+1))

echo 'Sleep 5 seconds'
sleep 5

echo 'Add port to redis'
# redis-bash-cli -h $REDIS_IP SADD serverSet $NEW_PORT
for i in `seq 1 $1`; do
	redis-bash-cli -h $REDIS_IP SADD serverSet "300$i"
done