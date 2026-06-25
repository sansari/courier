#!/bin/bash

# Load environment variables from .env file if it exists (optional).
# Deadline extraction uses pi's model config (~/.pi/agent/auth.json +
# models.json), not an API key from .env.
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run the app
npm run tauri:dev
