#!/bin/bash
NAME=vuemeter-system
DOMAIN=aldunelabs.com
SSH_OPTIONS="-o BatchMode=yes -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no"
SSH_TARGET="fboltz@10.129.134.132"

npm run pack

ssh ${SSH_OPTIONS} ${SSH_TARGET} rm -rf /home/fboltz/.local/share/gnome-shell/extensions/${NAME}@${DOMAIN} /home/fboltz/.cache/${NAME}/debug.log
scp ${SSH_OPTIONS} -p -r ${NAME}@${DOMAIN}.shell-extension.zip ${SSH_TARGET}:/home/fboltz
ssh ${SSH_OPTIONS} ${SSH_TARGET} unzip ${NAME}@${DOMAIN}.shell-extension.zip -d .local/share/gnome-shell/extensions/${NAME}@${DOMAIN}
