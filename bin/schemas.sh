#!/bin/bash
set -e

# Set the path to the directory containing the gschema XML files
pushd $(dirname "$0")/.. >/dev/null
EXTENSION_DIR=${PWD}
popd >/dev/null

SCHEMA_DIR=${EXTENSION_DIR}/schemas

# Compile the gschema XML files
glib-compile-schemas "$SCHEMA_DIR"
