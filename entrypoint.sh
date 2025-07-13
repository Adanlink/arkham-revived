#!/bin/sh

# Create usercfg directory if it doesn't exist
if [ ! -d "/usr/src/app/usercfg" ]; then
    mkdir -p /usr/src/app/usercfg
    echo "Created usercfg directory."
fi

# Check if basecfg is empty, and if so, copy the default config
if [ -z "$(ls -A /usr/src/app/basecfg)" ]; then
    echo "basecfg is empty, copying default configuration..."
    cp -r /usr/src/app/basecfg_default/* /usr/src/app/basecfg/
fi

# Execute the main command
exec "$@"
