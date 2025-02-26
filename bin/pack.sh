#!/bin/bash
# pack.sh - Script to package GNOME extension into a zip file for distribution
set -e

# Check for necessary tools
command -v bash >/dev/null 2>&1 || { echo >&2 "Bash is required but it's not installed. Aborting."; exit 1; }
command -v glib-compile-schemas >/dev/null 2>&1 || { echo >&2 "glib-compile-schemas is required but it's not installed. Aborting."; exit 1; }

# Function to log messages
log_message() {
    echo "[`date +"%Y-%m-%d %H:%M:%S"`] $1"
}

# Paths and filenames
pushd $(dirname "$0")/.. >/dev/null
EXTENSION_DIR=${PWD}
popd>/dev/null

DIST_DIR="${EXTENSION_DIR}/dist"
BUILD_DIR="${EXTENSION_DIR}/build"
EXTENSION_NAME="vuemeter-system@aldunelabs.com"

# Read VERSION from metadata.json
if [ -f "${EXTENSION_DIR}/metadata.json" ]; then
    VERSION=$(grep '"version"' "${EXTENSION_DIR}/metadata.json" | grep -o '[0-9]*')
    if [ -z "$VERSION" ]; then
        log_message "Version not found in metadata.json"
        exit 1
    fi
else
    log_message "metadata.json not found. Aborting."
    exit 1
fi

# Run schemas.sh
if [ -f "${EXTENSION_DIR}/bin/schemas.sh" ]; then
    log_message "Running schemas.sh..."
    bash "${EXTENSION_DIR}/bin/schemas.sh" || { log_message "schemas.sh failed. Aborting."; exit 1; }
else
    log_message "schemas.sh not found. Aborting."
    exit 1
fi

# Remove the previous build if any
rm -rf "vuemeter-system@aldunelabs.com.shell-extension.zip"

# Clean up build directory
rm -rf "${BUILD_DIR}"

# Install packages
npm install
export PATH="$PATH:$EXTENSION_DIR/node_modules/.bin"

# Check if tsc is installed
command -v tsc >/dev/null 2>&1 || { log_message "Error: tsc is required but it's not installed. Aborting."; exit 1; }

# Compile TypeScript
log_message "Building typescript files..."
tsc

# Check for errors
if [ $? -ne 0 ]; then
    log_message "Failed to compile TypeScript"
    exit 1
fi

# Format the code
log_message "Formatting the code..."
npm run format

# Check for errors
if [ $? -ne 0 ]; then
    log_message "Failed to format the code"
    exit 1
fi

# Run i18n.sh
if [ -f "${EXTENSION_DIR}/bin/i18n.sh" ]; then
    log_message "Running i18n.sh..."
    bash "${EXTENSION_DIR}/bin/i18n.sh" || { log_message "i18n.sh failed. Aborting."; exit 1; }
else
    log_message "i18n.sh not found. Aborting."
    exit 1
fi

# Create dist directory
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# Copy build directory content to dist directory
cp -r "${BUILD_DIR}/"* "${DIST_DIR}/"

# Files and directories to include
INCLUDE_FILES="metadata.json stylesheet.css README.md LICENSE schemas icons po"

# Copy files to dist directory
for file in $INCLUDE_FILES; do
    if [ -e "${EXTENSION_DIR}/${file}" ]; then
        cp -r "${EXTENSION_DIR}/${file}" "${DIST_DIR}/"
    else
        log_message "File or directory ${file} not found. Aborting."
        rm -rf "${DIST_DIR}"
        exit 1
    fi
done

# enter dist directory
pushd "${DIST_DIR}"

IFS=. read GNOME_VERSION_MAJOR GNOME_VERSION_MINOR <<< "$(gnome-extensions version)"

# Pack the extension
if [ ${GNOME_VERSION_MAJOR} -ge 47 ]; then
    gnome-extensions pack --force \
        --podir=./po \
        --schema=./schemas/org.gnome.shell.extensions.vuemeter-system.gschema.xml \
        --extra-source=./src \
        --extra-source=./icons \
        --extra-source=./LICENSE.md \
        --extra-source=./README.md \
        .
    # Add all schemas files
    zip -ur vuemeter-system@aldunelabs.com.shell-extension.zip schemas
else
    gnome-extensions pack --force \
        --podir=./po \
        --extra-source=./src \
        --extra-source=./schemas \
        --extra-source=./icons \
        --extra-source=./LICENSE.md \
        --extra-source=./README.md \
        .
fi

popd

# Check for errors
if [ $? -ne 0 ]; then
    log_message "Failed to pack the extension"

#   rm -rf "${DIST_DIR}"
    exit 1
fi

# Copy the packed extension to the main directory
mv "${DIST_DIR}/$EXTENSION_NAME.shell-extension.zip" "$EXTENSION_NAME.shell-extension.zip"

# Return to the main directory
cd ..

# Clean up: remove the dist directory
#rm -rf "${DIST_DIR}"

log_message "Extension packaged into $EXTENSION_NAME.shell-extension.zip"
exit 0
