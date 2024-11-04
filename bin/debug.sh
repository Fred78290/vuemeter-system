#!/bin/bash

bin/pack.sh

if [ -e "vuemeter-system@aldunelabs.com.shell-extension.zip" ]; then
    rm -rf ~/.local/share/gnome-shell/extension*/vuemeter-system\@aldunelabs.com/
    unzip vuemeter-system@aldunelabs.com.shell-extension.zip -d ~/.local/share/gnome-shell/extensions/vuemeter-system\@aldunelabs.com/

    WIDTH="`xrandr -q | sed -n '1{s/.*current \([0-9]\+\) x .*/\1/p}'`"
    HEIGHT="`xrandr -q | sed -n '1{s/.*current [0-9]\+ x \([0-9]\+\).*/\1/p}'`"

    export MUTTER_DEBUG_DUMMY_MODE_SPECS="${WIDTH}x$((HEIGHT/2))"
    export SHELL_DEBUG="all"
    export G_MESSAGES_DEBUG="none"

    dbus-run-session -- gnome-shell --nested --wayland
fi
