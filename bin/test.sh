#!/bin/bash
NAME=gnome-stats-pro2
DOMAIN=aldunelabs.com
SSH_OPTIONS="-o BatchMode=yes -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
SSH_TARGET="ubuntu@10.129.134.168"

$(dirname $0)/pack.sh

ssh ${SSH_OPTIONS} ${SSH_TARGET} rm -rf /home/ubuntu/.local/share/gnome-shell/extensions/${NAME}@${DOMAIN} /home/ubuntu/.cache/${NAME}/debug.log
scp ${SSH_OPTIONS} -p -r ${NAME}@${DOMAIN}.shell-extension.zip ${SSH_TARGET}:/home/ubuntu
ssh ${SSH_OPTIONS} ${SSH_TARGET} unzip ${NAME}@${DOMAIN}.shell-extension.zip -d .local/share/gnome-shell/extensions/${NAME}@${DOMAIN}
