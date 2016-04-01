#!/bin/bash
PLATFORM_TOOL="/usr/local/Cellar/android-sdk/24.4.1_1/platform-tools/adb"
test -x "$PLATFORM_TOOL" && exec "$PLATFORM_TOOL" "$@"
echo "It appears you do not have 'Android SDK Platform-tools' installed."
echo "Use the 'android' tool to install them: "
echo "    android update sdk --no-ui --filter 'platform-tools'"
